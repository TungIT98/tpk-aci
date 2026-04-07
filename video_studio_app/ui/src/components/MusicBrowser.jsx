import { useState, useEffect } from 'react'
import { api } from '../api.js'

const MOODS = ['all', 'energetic', 'calm', 'motivational', 'cinematic', 'playful']

export default function MusicBrowser({ selectedTemplate }) {
  const [tracks, setTracks] = useState([])
  const [filtered, setFiltered] = useState([])
  const [mood, setMood] = useState('all')
  const [suggested, setSuggested] = useState([])
  const [volumeArc, setVolumeArc] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { loadMusic() }, [])

  useEffect(() => {
    if (mood === 'all') setFiltered(tracks)
    else setFiltered(tracks.filter(t => t.mood === mood || t.tags?.includes(mood)))
  }, [mood, tracks])

  // Auto-suggest when template selected
  useEffect(() => {
    if (!selectedTemplate?.id) return
    loadSuggestions()
  }, [selectedTemplate?.id])

  async function loadMusic() {
    setLoading(true)
    try {
      const data = await api.listMusic()
      setTracks(data.tracks || [])
      setFiltered(data.tracks || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSuggestions() {
    try {
      const [sugg, arc] = await Promise.all([
        api.suggestMusic(selectedTemplate.id),
        api.getSceneVolumeArc(selectedTemplate.id),
      ])
      setSuggested(sugg.suggested_tracks || [])
      setVolumeArc(arc.volume_arc || [])
    } catch (e) {
      // Not critical — just don't show suggestions
    }
  }

  async function suggestForMood() {
    if (!mood || mood === 'all') return
    setLoading(true)
    try {
      const data = await api.suggestMusicForMood(mood, null)
      setFiltered(data.suggested_tracks || data.tracks || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Music Library</div>
            <div className="panel-subtitle">{tracks.length} royalty-free tracks across 5 moods</div>
          </div>
          {selectedTemplate && (
            <button className="btn btn-secondary btn-sm" onClick={loadSuggestions} disabled={loading}>
              🔄 Re-suggest for Template
            </button>
          )}
        </div>

        {/* Mood filter */}
        <div className="mood-filter">
          {MOODS.map(m => (
            <button
              key={m}
              className={`mood-chip${mood === m ? ' active' : ''}`}
              onClick={() => setMood(m)}
            >
              {m === 'all' ? '🌐 All' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>}

        {/* Suggested for template */}
        {suggested.length > 0 && (
          <div className="mb-16">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✨ Suggested for "{selectedTemplate?.name}"
            </div>
            <div className="music-grid">
              {suggested.map(t => (
                <MusicCard key={t.id || t.track_id} track={t} selected={selectedTrack?.id === t.id} onClick={() => setSelectedTrack(t)} />
              ))}
            </div>
          </div>
        )}

        {/* Volume arc */}
        {volumeArc.length > 0 && selectedTemplate && (
          <div className="mb-16">
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              🔊 Scene Volume Arc
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
              {volumeArc.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: `${v * 100}%`, background: 'var(--color-accent)', borderRadius: 4, opacity: 0.6 + v * 0.4, minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>S{i+1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All tracks */}
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
          All Tracks
        </div>
        <div className="music-grid">
          {filtered.map(t => (
            <MusicCard key={t.id || t.track_id} track={t} selected={selectedTrack?.id === t.id} onClick={() => setSelectedTrack(t)} />
          ))}
        </div>
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <p>No tracks found for this mood</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MusicCard({ track, selected, onClick }) {
  return (
    <div className={`music-card${selected ? ' selected' : ''}`} onClick={onClick}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>
        {track.mood === 'energetic' ? '⚡' : track.mood === 'calm' ? '🌿' : track.mood === 'motivational' ? '🚀' : track.mood === 'cinematic' ? '🎬' : '🎵'}
      </div>
      <div className="music-card-title">{track.title || track.name || 'Untitled'}</div>
      <div className="music-card-meta">
        {track.mood && <span className="tag">{track.mood}</span>}
        {track.duration && <span>{track.duration}</span>}
        {track.bpm && <span>{track.bpm} BPM</span>}
      </div>
      {track.tags && track.tags.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {track.tags.slice(0, 3).map(tag => <span key={tag} className="tag warning">{tag}</span>)}
        </div>
      )}
    </div>
  )
}
