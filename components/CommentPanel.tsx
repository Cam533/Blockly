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

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
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

