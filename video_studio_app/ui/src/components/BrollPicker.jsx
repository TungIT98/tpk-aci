import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function BrollPicker({ selectedTemplate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sceneSuggestions, setSceneSuggestions] = useState({})
  const [selectedForScene, setSelectedForScene] = useState({}) // sceneIdx -> clip
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  // Load B-roll suggestions for each scene when template changes
  useEffect(() => {
    if (!selectedTemplate?.id) return
    loadSceneSuggestions()
  }, [selectedTemplate?.id])

  async function loadSceneSuggestions() {
    if (!selectedTemplate?.scenes) return
    setLoading(true)
    const suggestions = {}
    try {
      for (let i = 0; i < selectedTemplate.scenes.length; i++) {
        const scene = selectedTemplate.scenes[i]
        const keywords = scene.footage_keywords || scene.footage?.keywords || []
        if (keywords.length === 0) continue
        try {
          const data = await api.suggestBroll(selectedTemplate.id, i)
          suggestions[i] = data.clips || data.options || []
        } catch {}
      }
      setSceneSuggestions(suggestions)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearchLoading(true)
    setError(null)
    try {
      const data = await api.searchBroll(query.trim(), page)
      setResults(data.clips || data.results || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setSearchLoading(false)
    }
  }

  function selectClipForScene(sceneIdx, clip) {
    setSelectedForScene(prev => ({ ...prev, [sceneIdx]: clip }))
  }

  return (
    <div className="content">
      <div className="panel">
        <div className="panel-title mb-8">B-Roll Auto-Suggestion</div>
        <div className="panel-subtitle mb-16">
          B-roll clips are auto-suggested based on each scene's footage keywords.
          {!selectedTemplate && ' Select a template to see scene-level suggestions.'}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="topic-input-wrap mb-16">
          <input
            className="topic-input"
            placeholder="Search for B-roll footage (e.g., 'office workspace', 'coffee pour')..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searchLoading || !query.trim()}>
            {searchLoading ? <div className="spinner" /> : '🔍 Search'}
          </button>
        </form>

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {/* Search results */}
        {results.length > 0 && (
          <div className="mb-16">
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Search Results ({results.length})
            </div>
            <div className="broll-grid">
              {results.map((clip, i) => (
                <BrollCard key={clip.id || i} clip={clip} onSelect={() => {}} />
              ))}
            </div>
          </div>
        )}

        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>}

        {/* Scene-level suggestions */}
        {selectedTemplate?.scenes && !loading && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              Scene B-Roll Suggestions
            </div>
            {selectedTemplate.scenes.map((scene, i) => {
              const clips = sceneSuggestions[i] || []
              const selected = selectedForScene[i]
              return (
                <div key={i} className="panel" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{scene.scene_name || `Scene ${i + 1}`}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        Keywords: {scene.footage_keywords?.join(', ') || scene.footage?.keywords?.join(', ') || 'none'}
                      </div>
                    </div>
                    {selected && <span className="tag success">✓ Selected</span>}
                  </div>

                  {clips.length > 0 ? (
                    <div className="broll-grid">
                      {clips.slice(0, 3).map((clip, j) => (
                        <BrollCard
                          key={clip.id || j}
                          clip={clip}
                          selected={selected?.id === clip.id}
                          onSelect={() => selectClipForScene(i, clip)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 0' }}>
                      No clips suggested — set footage_keywords on this scene
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function BrollCard({ clip, selected, onSelect }) {
  return (
    <div className={`broll-card${selected ? ' selected' : ''}`} onClick={onSelect}>
      <div className="broll-thumb">
        {clip.thumbnail_url || clip.preview_url ? (
          <img src={clip.thumbnail_url || clip.preview_url} alt={clip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          '🎬'
        )}
      </div>
      <div className="broll-info">
        <div className="broll-title">{clip.title || clip.name || 'Untitled Clip'}</div>
        <div className="broll-source">{clip.source || clip.provider || 'Stock footage'}</div>
        {clip.duration && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>⏱️ {clip.duration}s</div>}
      </div>
    </div>
  )
}
