import { NextRequest, NextResponse } from 'next/server'
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from '@/lib/prisma'

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
    const plotComments = await (prisma as any).comment.findMany({
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

    // Fetch neighbors for this plot (with error handling)
    let neighborComments: any[] = []
    try {
      const neighbors = await (prisma as any).neighbors.findUnique({
        where: { id: parseInt(plotId) },
        select: {
          neighborIds: true,
        },
      })

      // Fetch comments from neighbor plots
      if (neighbors && neighbors.neighborIds && neighbors.neighborIds.length > 0) {
        neighborComments = await (prisma as any).comment.findMany({
          where: {
            plotId: { in: neighbors.neighborIds },
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
      }
    } catch (neighborError) {
      // If neighbors table doesn't exist or query fails, just continue without neighbor comments
      console.warn('Could not fetch neighbor comments:', neighborError)
    }

    // Combine plot comments and neighbor comments
    const comments = [...plotComments, ...neighborComments]

    if (comments.length === 0) {
      return NextResponse.json({ 
        summary: 'No comments yet for this plot or its nearby plots. Be the first to share your ideas!' 
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

    // Sort plot comments by score (upvote - downvote) to prioritize popular suggestions
    const sortedPlotComments = plotComments.sort((a: any, b: any) => {
      const scoreA = a.upvote - a.downvote
      const scoreB = b.upvote - b.downvote
      return scoreB - scoreA
    })

    // Sort neighbor comments by score
    const sortedNeighborComments = neighborComments.sort((a: any, b: any) => {
      const scoreA = a.upvote - a.downvote
      const scoreB = b.upvote - b.downvote
      return scoreB - scoreA
    })

    // Take top comments for context
    const topPlotComments = sortedPlotComments.slice(0, 15).map((c: any) => c.content)
    const topNeighborComments = sortedNeighborComments.slice(0, 10).map((c: any) => c.content)

    // Generate summary using Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    const addressContext = plot?.address ? ` at ${plot.address}` : ''
    
    let prompt = `You are analyzing community feedback for a vacant plot${addressContext} in Philadelphia. 

Comments from residents about this specific plot:
${topPlotComments.length > 0 ? topPlotComments.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : 'No comments yet for this plot.'}`

    if (topNeighborComments.length > 0) {
      prompt += `\n\nComments from residents about nearby plots:
${topNeighborComments.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`
    }

    prompt += `\n\nWrite exactly 2 sentences summarizing the feedback. First sentence: "Residents in this area would like to see [list main suggestions from this plot's comments]." Second sentence: ${topNeighborComments.length > 0 ? '"Neighboring plots have suggestions like [list main suggestions from neighbor comments]."' : 'Summarize any additional context or themes.'} Do not just list comments verbatim - synthesize them naturally. Focus on the most popular and repeated suggestions. Write in a clear, professional tone suitable for city planning.

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
      const allComments = [...topPlotComments, ...topNeighborComments]
      const fallbackSummary = generateSimpleSummary(allComments, plot?.address)
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
 *   plot_id, comments: [{ comment_id, content, ... }]
 * }
 *
 * Returns { summary: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Input shapes
    const commentsArray: any[] = Array.isArray(body.comments) ? body.comments : []
    const plotId = body.plot_id ?? body.plotId ?? null

    // Extract plot comment texts
    const plotCommentTexts = commentsArray.map((c) => String(c.content ?? c.text ?? '')).filter(Boolean)

    // Fetch neighbor comments if plotId is provided
    let neighborCommentTexts: string[] = []
    if (plotId) {
      try {
        const neighbors = await (prisma as any).neighbors.findUnique({
          where: { id: parseInt(String(plotId)) },
          select: {
            neighborIds: true,
          },
        })

        if (neighbors && neighbors.neighborIds && neighbors.neighborIds.length > 0) {
          const neighborComments = await (prisma as any).comment.findMany({
            where: {
              plotId: { in: neighbors.neighborIds },
            },
            select: {
              content: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          neighborCommentTexts = neighborComments.map((c: any) => String(c.content ?? '')).filter(Boolean)
        }
      } catch (neighborError) {
        // If neighbors table doesn't exist or query fails, just continue without neighbor comments
        console.warn('Could not fetch neighbor comments:', neighborError)
      }
    }

    // Check if we have any comments
    if (plotCommentTexts.length === 0 && neighborCommentTexts.length === 0) {
      return NextResponse.json({ 
        summary: 'No comments yet for this plot or its nearby plots. Be the first to share your ideas!' 
      })
    }

    // Get plot info for context
    let plotAddress: string | null = null
    if (plotId) {
      try {
        const plot = await (prisma as any).plot.findUnique({
          where: { id: parseInt(String(plotId)) },
          select: {
            address: true,
          },
        })
        plotAddress = plot?.address || null
      } catch (err) {
        // Ignore errors fetching plot info
      }
    }

    // Generate summary using Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    const addressContext = plotAddress ? ` at ${plotAddress}` : ''
    
    let prompt = `You are analyzing community feedback for a vacant plot${addressContext} in Philadelphia. 

Comments from residents about this specific plot:
${plotCommentTexts.length > 0 ? plotCommentTexts.slice(0, 30).map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : 'No comments yet for this plot.'}`

    if (neighborCommentTexts.length > 0) {
      prompt += `\n\nComments from residents about nearby plots:
${neighborCommentTexts.slice(0, 20).map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`
    }

    prompt += `\n\nWrite exactly 2 sentences summarizing the feedback. First sentence: "Residents in this area would like to see [list main suggestions from this plot's comments]." Second sentence: ${neighborCommentTexts.length > 0 ? '"Neighboring plots have suggestions like [list main suggestions from neighbor comments]."' : 'Summarize any additional context or themes.'} Do not just list comments verbatim - synthesize them naturally. Focus on the most popular and repeated suggestions. Write in a clear, professional tone suitable for city planning.

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
      const allComments = [...plotCommentTexts, ...neighborCommentTexts]
      const fallbackSummary = generateSimpleSummary(allComments, plotAddress)
      return NextResponse.json({ summary: fallbackSummary })
    }
  } catch (error) {
    console.error('[summary POST] error:', error)
    return NextResponse.json({ error: 'Failed to summarize comments' }, { status: 500 })
  }
}

