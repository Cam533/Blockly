'use client'

import { useState } from 'react'
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
  const [showSummary, setShowSummary] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summaryData, setSummaryData] = useState<{
    summary?: string
    recommendations?: string[]
    representativeComments?: string[]
    _debug?: any
  } | null>(null)
  const CACHE_TTL = 1000 * 60 * 15 // 15 minutes

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
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      setCommentText('')
      onCommentAdded()
    } catch (err) {
      setError('Failed to add comment. Please try again.')
    } finally {
      setLoading(false)
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
        recommendations: data.recommendations || data.recs || [],
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
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      width: '384px',
      backgroundColor: 'white',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      zIndex: 1000,
      maxHeight: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>Plot Details</h2>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '4px' }}>{plot.address || 'No address'}</p>
            {plot.vacantFlag && (
              <p style={{ fontSize: '12px', color: '#6b7280' }}>Status: {plot.vacantFlag}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setShowSummary(true)
                // Trigger fetch immediately when opening the modal
                fetchSummary()
              }}
              title={'See summary generated from comments'}
              style={{
                padding: '6px 10px',
                backgroundColor: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              See Summary
            </button>

            <button
              onClick={onClose}
            style={{
              fontSize: '24px',
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#4b5563'}
            onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            ×
          </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
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

                  {summaryData.recommendations && summaryData.recommendations.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <h4 style={{ margin: '8px 0' }}>Recommendations</h4>
                      <ul>
                        {summaryData.recommendations.map((r, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryData.representativeComments && summaryData.representativeComments.length > 0 && (
                    <div>
                      <h4 style={{ margin: '8px 0' }}>Representative Comments</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summaryData.representativeComments.map((c, idx) => (
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
        <h3 style={{ fontWeight: '600', marginBottom: '12px' }}>Comments ({comments.length})</h3>
        {comments.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#6b7280' }}>No comments yet. Be the first to comment!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {comments.map((comment) => (
              <div key={comment.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{comment.user.username}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: '#374151' }}>{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {error && <p style={{ fontSize: '14px', color: '#ef4444' }}>{error}</p>}
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              resize: 'none',
              fontFamily: 'inherit'
            }}
            rows={3}
            required
          />
          <button
            type="submit"
            disabled={loading || !commentText.trim()}
            style={{
              width: '100%',
              padding: '8px 16px',
              backgroundColor: loading || !commentText.trim() ? '#9ca3af' : '#3b82f6',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              cursor: loading || !commentText.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseOver={(e) => {
              if (!loading && commentText.trim()) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
            onMouseOut={(e) => {
              if (!loading && commentText.trim()) {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }
            }}
          >
            {loading ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      </div>
    </div>
  )
}

