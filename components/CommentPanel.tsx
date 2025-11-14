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
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    setLocalComments(comments)
  }, [comments])

  useEffect(() => {
    // Fetch summary when plot changes or comments change
    const fetchSummary = async () => {
      if (comments.length === 0) {
        setSummary(null)
        return
      }

      setSummaryLoading(true)
      try {
        const response = await fetch(`/api/comments/summary?plotId=${plot.id}`)
        if (response.ok) {
          const data = await response.json()
          setSummary(data.summary)
        }
      } catch (err) {
        console.error('Error fetching summary:', err)
      } finally {
        setSummaryLoading(false)
      }
    }

    fetchSummary()
  }, [plot.id, comments.length])

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
            {summary && !summaryLoading && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                <h3 className="text-xs font-semibold text-blue-900 mb-1 uppercase tracking-wide">AI Summary</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
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
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>Comments</span>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            {localComments.length}
          </span>
        </h3>
        {localComments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-1">No comments yet.</p>
            <p className="text-xs text-gray-400">Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
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

