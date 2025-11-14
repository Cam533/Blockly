'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { LatLngExpression } from 'leaflet'
import L from 'leaflet'
import CommentPanel from './CommentPanel'
import type { User } from '@/lib/auth'

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface Plot {
  id: number
  objectid: number | null
  longitude: number | null
  latitude: number | null
  address: string | null
  vacantFlag: string | null
  vacantRank: number | null
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

export default function Map({ user }: { user: User }) {
  const [plots, setPlots] = useState<Plot[]>([])
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  // Philadelphia center coordinates
  const phillyCenter: LatLngExpression = [39.9526, -75.1652]

  useEffect(() => {
    fetchPlots()
  }, [])

  useEffect(() => {
    if (selectedPlot) {
      fetchComments(selectedPlot.id)
    }
  }, [selectedPlot])

  const fetchPlots = async () => {
    try {
      const response = await fetch('/api/plots')
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = await response.json()
      console.log('Fetched plots:', data.length)
      setPlots(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching plots:', error)
      setLoading(false)
    }
  }

  const fetchComments = async (plotId: number) => {
    try {
      const response = await fetch(`/api/comments?plotId=${plotId}`)
      const data = await response.json()
      setComments(data)
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const handlePlotClick = (plot: Plot) => {
    setSelectedPlot(plot)
  }

  const handleClosePanel = () => {
    setSelectedPlot(null)
    setComments([])
  }

  const handleCommentAdded = () => {
    if (selectedPlot) {
      fetchComments(selectedPlot.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading map...</p>
      </div>
    )
  }

  if (plots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-lg mb-2">No plots found</p>
        <p className="text-sm text-gray-600">Make sure you've uploaded plots using: npm run upload:plots</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full" style={{ height: '100%', width: '100%', minHeight: '400px', backgroundColor: '#f0f0f0' }}>
      <div className="absolute top-2 left-2 bg-white px-3 py-2 rounded shadow z-[1000] text-sm">
        {plots.length} plots loaded
      </div>
      <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
        <MapContainer
          center={phillyCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {plots.map((plot) => {
          if (!plot.latitude || !plot.longitude) return null
          
          // Color based on vacant rank (red = high, yellow = medium, green = low)
          const getColor = (rank: number | null) => {
            if (!rank) return '#3388ff'
            if (rank >= 0.7) return '#ff0000'
            if (rank >= 0.4) return '#ffaa00'
            return '#00ff00'
          }

          return (
            <CircleMarker
              key={plot.id}
              center={[plot.latitude, plot.longitude]}
              radius={8}
              pathOptions={{
                color: getColor(plot.vacantRank),
                fillColor: getColor(plot.vacantRank),
                fillOpacity: 0.6,
              }}
              eventHandlers={{
                click: () => handlePlotClick(plot),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{plot.address || 'No address'}</p>
                  <p>Vacant: {plot.vacantFlag || 'N/A'}</p>
                  {plot.vacantRank !== null && (
                    <p>Rank: {plot.vacantRank.toFixed(2)}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
        </MapContainer>
      </div>

      {selectedPlot && (
        <CommentPanel
          plot={selectedPlot}
          comments={comments}
          user={user}
          onClose={handleClosePanel}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </div>
  )
}

