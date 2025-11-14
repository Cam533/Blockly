'use client'

import { useState, useEffect } from 'react'
import type { User } from '@/lib/auth'

interface Plot {
  id: number
  address: string | null
  vacantFlag: string | null
}

interface Comment {
  id: number
  content: string
  createdAt: string
  upvote: number
  downvote: number
  user: {
    id: number
    username: string
  }
}
 
interface CommentPanelProps {
  plot: Plot
  comments: Comment[]
  user: User
  onClose: () => void
  onCommentAdded: () => void
}

export default function CommentPanel({
  plot,
  comments,
  user,
  onClose,
  onCommentAdded,
}: CommentPanelProps) {
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localComments, setLocalComments] = useState<Comment[]>(comments)
  const [neighborComments, setNeighborComments] = useState<Comment[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string>('')
  const [summaryData, setSummaryData] = useState<any>(null)
  const [showSummary, setShowSummary] = useState(false)

  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  useEffect(() => {
    setLocalComments(comments)
    fetchNeighborComments()
  }, [comments, plot.id])

  const fetchNeighborComments = async () => {
    try {
      // Fetch neighbors for this plot
      const neighborsRes = await fetch(`/api/plots/${plot.id}/neighbors`)
      if (neighborsRes.ok) {
        const neighborsData = await neighborsRes.json()
        if (neighborsData.neighborIds && neighborsData.neighborIds.length > 0) {
          // Fetch comments from all neighbor plots
          const neighborCommentsPromises = neighborsData.neighborIds.map(async (neighborId: number) => {
            const res = await fetch(`/api/comments?plotId=${neighborId}`)
            if (res.ok) {
              return await res.json()
            }
            return []
          })
          const neighborCommentsArrays = await Promise.all(neighborCommentsPromises)
          const allNeighborComments = neighborCommentsArrays.flat()
          setNeighborComments(allNeighborComments)
        }
      }
    } catch (err) {
      console.warn('Failed to fetch neighbor comments:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plotId: plot.id,
          userId: user.id,
          content: commentText.trim(),
          upvote: 0,
          downvote: 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      setCommentText('')
      // Clear summary cache when new comment is added so summary can be regenerated
      try {
        const key = `plot_summary_${plot.id}`
        localStorage.removeItem(key)
        setSummaryData(null)
      } catch (err) {
        console.warn('Failed to clear summary cache', err)
      }
      onCommentAdded()
    } catch (err) {
      setError('Failed to add comment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (commentId: number, voteType: 'upvote' | 'downvote') => {
    try {
      const response = await fetch(`/api/comments/${commentId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType }),
      })

      if (!response.ok) {
        throw new Error('Failed to vote')
      }

      const updatedComment = await response.json()
      
      // Update local comments state
      setLocalComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId ? updatedComment : comment
        )
      )
    } catch (err) {
      console.error('Error voting:', err)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const fetchSummary = async () => {
    setSummaryLoading(true)
    setSummaryError('')
    setSummaryData(null)

    try {
      // Fetch latest comments for this plot from the backend so we send ALL comments
      let allComments: Comment[] = comments
      try {
        const commentsRes = await fetch(`/api/comments?plotId=${plot.id}`)
        if (commentsRes.ok) {
          const json = await commentsRes.json()
          // Expect an array of comments; if successful, use that
          if (Array.isArray(json)) {
            allComments = json
          }
        }
      } catch (err) {
        // If this fails, fall back to the provided `comments` prop
        console.warn('Failed to fetch latest comments, falling back to local prop', err)
      }

      // Build a lightweight payload for the summary endpoint from the freshest comments
      const payload = {
        plot_id: plot.id,
        comments_count: allComments.length,
        comments: allComments.map((c: any) => ({ id: c.id, content: c.content, username: c.user?.username || c.username })),
      }

      // Check local cache first to avoid frequent LLM calls
      try {
        const key = `plot_summary_${plot.id}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (
            parsed &&
            parsed.comments_count === payload.comments_count &&
            Date.now() - (parsed.fetchedAt || 0) < CACHE_TTL
          ) {
            // Use cached data
            setSummaryData(parsed.data)
            setSummaryLoading(false)
            return
          }
        }
      } catch (err) {
        // Ignore cache errors (e.g., JSON parse issues) and continue to fetch
        console.warn('Summary cache check failed', err)
      }

      const res = await fetch('/api/comments/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Summary request failed')
      }

      // Normalize common response shapes
      const normalized: any = {
        summary: data.summary || data.summaryText || data.description || undefined,
        representativeComments: data.representativeComments || data.representative_comments || data.topComments || [],
        _debug: data._debug || data.debug || null,
      }

      // Persist to cache for subsequent requests
      try {
        const key = `plot_summary_${plot.id}`
        const payloadToStore = { fetchedAt: Date.now(), comments_count: payload.comments_count, data: normalized }
        localStorage.setItem(key, JSON.stringify(payloadToStore))
      } catch (err) {
        console.warn('Failed to write summary cache', err)
      }

      setSummaryData(normalized)
    } catch (err: any) {
      console.error('Summary fetch error', err)
      setSummaryError(err?.message || 'Failed to fetch summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="absolute top-4 right-4 w-96 bg-white shadow-2xl rounded-xl z-[1000] max-h-[calc(100vh-120px)] flex flex-col border border-gray-100">
      <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Plot Details</h2>
            <p className="text-sm text-gray-700 mb-1 font-medium">{plot.address || 'No address'}</p>
            {plot.vacantFlag && (
              <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full mb-3">
                {plot.vacantFlag}
              </span>
            )}
            {summaryLoading && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500">Generating summary...</p>
              </div>
            )}
            {summaryData?.summary && !summaryLoading && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                <h3 className="text-xs font-semibold text-blue-900 mb-1 uppercase tracking-wide">AI Summary</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{summaryData.summary}</p>
              </div>
            )}
            {localComments.length > 0 && (
              <button
                onClick={fetchSummary}
                disabled={summaryLoading}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {summaryLoading ? 'Generating...' : summaryData ? 'Regenerate AI Summary' : 'Generate AI Summary'}
              </button>
            )}
            {summaryError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{summaryError}</p>
                <button
                  onClick={fetchSummary}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 ml-2"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
        {/* Summary modal */}
        {showSummary && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }} onClick={() => setShowSummary(false)}>
            <div style={{ width: '640px', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: '8px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Plot Summary</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setShowSummary(false) }} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>
              </div>

              {summaryLoading ? (
                <p>Loading summary…</p>
              ) : summaryError ? (
                <p style={{ color: '#ef4444' }}>{summaryError}</p>
              ) : summaryData ? (
                <div>
                  {summaryData.summary && <p style={{ marginBottom: '12px' }}>{summaryData.summary}</p>}

                  {summaryData.representativeComments && summaryData.representativeComments.length > 0 && (
                    <div>
                      <h4 style={{ margin: '8px 0' }}>Representative Comments</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summaryData.representativeComments.map((c: string, idx: number) => (
                          <div key={idx} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>{c}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debug info if present */}
                  {summaryData._debug && (
                    <details style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <summary>Debug info</summary>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summaryData._debug, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ) : (
                <div>
                  <p>No summary yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>Comments</span>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {localComments.length}
            </span>
          </h3>
          {localComments.length > 0 && (
            <button
              onClick={fetchSummary}
              disabled={summaryLoading}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-blue-400 disabled:to-indigo-400 text-white text-xs font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              {summaryLoading ? 'Generating...' : summaryData ? 'Regenerate' : 'AI Summary'}
            </button>
          )}
        </div>
        {localComments.length === 0 && neighborComments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-1">No comments yet.</p>
            <p className="text-xs text-gray-400">Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {localComments.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Plot Comments</h4>
                {localComments.map((comment) => (
                  <div key={comment.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">{comment.user.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-semibold text-sm text-gray-900">{comment.user.username}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{comment.content}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleVote(comment.id, 'upvote')}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-green-100 border border-gray-200 hover:border-green-300 rounded-lg cursor-pointer transition-all hover:scale-110"
                      >
                        <span className="text-green-600 text-sm">▲</span>
                      </button>
                      <span className="text-sm font-semibold text-gray-900 min-w-[30px] text-center">
                        {comment.upvote - comment.downvote}
                      </span>
                      <button
                        onClick={() => handleVote(comment.id, 'downvote')}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-red-100 border border-gray-200 hover:border-red-300 rounded-lg cursor-pointer transition-all hover:scale-110"
                      >
                        <span className="text-red-600 text-sm">▼</span>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {neighborComments.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 mt-4">Nearby Plot Comments</h4>
                {neighborComments.map((comment) => (
                  <div key={comment.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">{comment.user?.username?.charAt(0).toUpperCase() || '?'}</span>
                        </div>
                        <span className="font-semibold text-sm text-gray-900">{comment.user?.username || 'Anonymous'}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{comment.content}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleVote(comment.id, 'upvote')}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-green-100 border border-gray-200 hover:border-green-300 rounded-lg cursor-pointer transition-all hover:scale-110"
                      >
                        <span className="text-green-600 text-sm">▲</span>
                      </button>
                      <span className="text-sm font-semibold text-gray-900 min-w-[30px] text-center">
                        {comment.upvote - comment.downvote}
                      </span>
                      <button
                        onClick={() => handleVote(comment.id, 'downvote')}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-red-100 border border-gray-200 hover:border-red-300 rounded-lg cursor-pointer transition-all hover:scale-110"
                      >
                        <span className="text-red-600 text-sm">▼</span>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-5 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none text-sm"
            rows={3}
            required
          />
          <button
            type="submit"
            disabled={loading || !commentText.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:hover:shadow-md transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
          >
            {loading ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      </div>
    </div>
  )
}

