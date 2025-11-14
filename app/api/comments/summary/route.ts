import { NextRequest, NextResponse } from 'next/server'
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from '@/lib/prisma'


type Theme = { theme: string; count: number }

/**
 * GET /api/comments/summary?plotId=123
 * Fetches comments for a plot and generates a 2-sentence summary
 * Returns { summary: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plotId = searchParams.get('plotId')

    if (!plotId) {
      return NextResponse.json({ error: 'plotId is required' }, { status: 400 })
    }

    // Fetch comments for this plot
    const comments = await (prisma as any).comment.findMany({
      where: {
        plotId: parseInt(plotId),
      },
      select: {
        content: true,
        upvote: true,
        downvote: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (comments.length === 0) {
      return NextResponse.json({ 
        summary: 'No comments yet for this plot. Be the first to share your ideas!' 
      })
    }

    // Get plot info for context
    const plot = await (prisma as any).plot.findUnique({
      where: { id: parseInt(plotId) },
      select: {
        address: true,
        vacantFlag: true,
      },
    })

    // Sort comments by score (upvote - downvote) to prioritize popular suggestions
    const sortedComments = comments.sort((a: any, b: any) => {
      const scoreA = a.upvote - a.downvote
      const scoreB = b.upvote - b.downvote
      return scoreB - scoreA
    })

    // Take top comments (up to 20) for context
    const topComments = sortedComments.slice(0, 20).map((c: any) => c.content)

    // Generate summary using Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    const addressContext = plot?.address ? ` at ${plot.address}` : ''
    const prompt = `You are analyzing community feedback for a vacant plot${addressContext} in Philadelphia. 

Here are the comments from residents about what they'd like to see built here:
${topComments.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

Based on these comments, write exactly 2 sentences summarizing what should be done at this plot. Be specific and actionable. Focus on the most popular and repeated suggestions. Write in a clear, professional tone suitable for city planning.

Return ONLY the 2 sentences, nothing else.`

    try {
      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          { role: 'user', content: prompt }
        ],
      })

      const firstContent = response.content[0]
      const summary = firstContent && 'text' in firstContent
        ? firstContent.text.trim()
        : 'Unable to generate summary at this time.'

      return NextResponse.json({ summary })
    } catch (llmError) {
      console.error('LLM error:', llmError)
      // Fallback to simple summary
      const fallbackSummary = generateSimpleSummary(topComments, plot?.address)
      return NextResponse.json({ summary: fallbackSummary })
    }
  } catch (error) {
    console.error('[summary GET] error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}

function generateSimpleSummary(comments: string[], address?: string | null): string {
  // Simple keyword-based summary
  const allText = comments.join(' ').toLowerCase()
  
  let suggestions: string[] = []
  if (allText.includes('park') || allText.includes('playground') || allText.includes('green')) {
    suggestions.push('a park or green space')
  }
  if (allText.includes('cafe') || allText.includes('restaurant') || allText.includes('food')) {
    suggestions.push('a cafe or restaurant')
  }
  if (allText.includes('gym') || allText.includes('fitness') || allText.includes('exercise')) {
    suggestions.push('a fitness center')
  }
  if (allText.includes('garden') || allText.includes('community garden')) {
    suggestions.push('a community garden')
  }
  if (allText.includes('housing') || allText.includes('apartment') || allText.includes('residential')) {
    suggestions.push('affordable housing')
  }
  if (allText.includes('community center') || allText.includes('meeting')) {
    suggestions.push('a community center')
  }

  if (suggestions.length === 0) {
    suggestions = ['community development']
  }

  const location = address ? ` at ${address}` : ' here'
  return `Based on community feedback, residents would like to see ${suggestions.slice(0, 2).join(' or ')}${location}. The most popular suggestions focus on improving neighborhood amenities and quality of life.`
}

/**
 * POST /api/comments/summary
 * Accepts an aggregated payload like:
 * {
 *   plot_id, comments_count, topComments, comments: [{ comment_id, content, ... }]
 * }
 *
 * Returns { summary, recommendations, themes, representativeComments }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Input shapes
    const commentsArray: any[] = Array.isArray(body.comments) ? body.comments : []
    const topComments: string[] = Array.isArray(body.topComments) ? body.topComments : []
    const plotId = body.plot_id ?? body.plotId ?? null
    const topK = Number(body.topK ?? 3)
    const debug = Boolean(body.debug === true)
    const mock = Boolean(body.mock === true)

    // Build comment texts for prompt
    const commentTexts = commentsArray.length > 0 ? commentsArray.map((c) => String(c.content ?? c.text ?? '')) : topComments

    if (mock) {
      const sample = {
        summary: 'Residents are mainly concerned about traffic and pedestrian safety, poor lighting at night, and parking pressures that affect local businesses. Repeated comments call for better crosswalk timing, improved street lighting, and measures to reduce through-traffic. Short-term interventions could address lighting and signal timing while longer-term work could add greenspace and loading zones.',
        recommendations: [
          'Adjust signal timing and add pedestrian-first crossing phases at the main intersection to improve safety for seniors and children.',
          'Install targeted street lighting and visibility improvements along poorly lit corridors like Maple.',
          'Create designated loading/delivery zones and implement time-limited parking to reduce circling and improve access for local businesses.'
        ],
        
        representativeComments: topComments.slice(0, topK),
      }
      return NextResponse.json(debug ? { ...sample, _debug: { llmCalled: false, usedModel: null } } : sample)
    }

    // Construct a strict prompt asking for JSON only
    const sampleCommentsText = (topComments.length > 0 ? topComments : commentTexts).slice(0, 50).map((c, i) => `${i + 1}. ${c}`).join('\n')
    const basePrompt = `You are an assistant that summarizes community feedback for city planning.\n\nContext: these comments are for plot_id: ${plotId ?? 'UNKNOWN'}.\n\nRepresentative comments:\n${sampleCommentsText}\n\nPlease produce a single valid JSON object (no prose) with the following keys:\n- summary: a 3-4 sentence summary of the main concerns\n- recommendations: an array of exactly three short (1-2 sentence) actionable interventions a city planner could implement\n- themes: an array of objects {"theme": string, "count": number} describing major themes and counts\n- representativeComments: an array of the top ${topK} representative comments\n\nReturn ONLY a valid JSON object and nothing else.`

    // Call Anthropic (try Responses API first, then completions/complete)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Inside your POST handler:
    let llmCalled = false
    let usedModel = "claude-3-haiku-20240307"
    let modelOutput = ""

    try {
    llmCalled = true
    
    const res = await client.messages.create({
        model: usedModel,
        max_tokens: 1000,
        messages: [
        { role: "user", content: basePrompt }
        ],
    })

    const firstContent = res.content?.[0]
    modelOutput = (firstContent && 'text' in firstContent) ? firstContent.text : ""
    } catch (err) {
    console.error("LLM call failed:", err)
    llmCalled = false
    }

    // Try to extract JSON
    let parsed: any = null
    if (modelOutput) {
      const jsonText = extractJson(modelOutput)
      if (jsonText) {
        try {
          parsed = JSON.parse(jsonText)
        } catch (e) {
          // parsing failed
        }
      }
    }

    // If parsed JSON contains recommendations, return it
    if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
      const out = {
        summary: parsed.summary ?? '',
        recommendations: parsed.recommendations.slice(0, 3),
        representativeComments: parsed.representativeComments ?? topComments.slice(0, topK),
      }
      return NextResponse.json(debug ? { ...out, _debug: { llmCalled, usedModel, modelOutputSnippet: String(modelOutput).slice(0, 200) } } : out)
    }

    // Fallback heuristics
  const themes = simpleThemes(commentTexts)
  const recommendations = generateHeuristicRecommendations(themes).slice(0, 3)
    const summary = parsed?.summary ?? simpleSummary(commentTexts)
    const representativeComments = topComments.length > 0 ? topComments.slice(0, topK) : commentTexts.slice(0, topK)
  const fallback = { summary, recommendations, representativeComments }
    return NextResponse.json(debug ? { ...fallback, _debug: { llmCalled, usedModel, modelOutputSnippet: String(modelOutput).slice(0, 200) } } : fallback)
  } catch (error) {
    console.error('[summary] unexpected error', error)
    return NextResponse.json({ error: 'Failed to summarize comments' }, { status: 500 })
  }
}

function extractJson(text: string): string | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1)
  return null
}

function simpleSummary(comments: string[]) {
  const joined = comments.join(' ')
  const sentences = joined.split(/[\.\!\?]\s+/).filter(Boolean)
  return sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '.' : '')
}

function simpleThemes(comments: string[]): Theme[] {
  const stop = new Set(['the', 'and', 'to', 'a', 'of', 'in', 'is', 'for', 'on', 'we', 'i', 'it', 'with', 'that', 'this', 'are', 'be', 'as', 'was', 'but', 'have', 'has'])
  const freq = new Map<string, number>()
  for (const c of comments) {
    const words = c.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    for (const w of words) {
      if (w.length < 3) continue
      if (stop.has(w)) continue
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  return Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([theme, count]) => ({ theme, count }))
}

function generateHeuristicRecommendations(themes: Theme[]) {
  const recs: string[] = []
  for (const t of themes.slice(0, 5)) {
    if (/park|tree|bench|streetscape/.test(t.theme)) recs.push('Invest in greenspace and street furniture (trees, benches) to improve neighborhood livability.')
    else if (/parking/.test(t.theme)) recs.push('Introduce targeted parking management: time-limited parking, dedicated loading zones, and enforcement to reduce circling.')
    else if (/traffic|through|speed/.test(t.theme)) recs.push('Pilot traffic calming measures (e.g., curb extensions, raised crosswalks, speed cushions) to reduce through-traffic and improve safety.')
    else if (/light|lighting|safe/.test(t.theme)) recs.push('Improve street lighting and sightlines on poorly lit corridors to increase nighttime safety.')
    else if (/bike|cycle|bicycle/.test(t.theme)) recs.push('Create and enforce protected bike lanes and add bike parking to encourage cycling and reduce short car trips.')
    else if (/bus|transit|route/.test(t.theme)) recs.push('Increase transit frequency on the affected routes and improve stop amenities to encourage public transport use.')
    if (recs.length >= 3) break
  }
  while (recs.length < 3) recs.push('Engage the community with a public workshop to prioritize short-term and long-term interventions.')
  return recs
}
