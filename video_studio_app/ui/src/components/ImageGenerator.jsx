import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function ImageGenerator({ selectedTemplate }) {
  const [profiles, setProfiles] = useState([])
  const [newProfile, setNewProfile] = useState({ name: '', description: '', lora_path: '' })
  const [sceneIndices, setSceneIndices] = useState([])
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [generatingProfiles, setGeneratingProfiles] = useState(false)

  useEffect(() => { loadProfiles() }, [])
  useEffect(() => {
    if (selectedTemplate?.scenes) {
      setSceneIndices(selectedTemplate.scenes.map((_, i) => i))
    }
  }, [selectedTemplate?.id])

  async function loadProfiles() {
    try {
      const data = await api.getCharacterProfiles()
      setProfiles(data.profiles || data.characters || [])
    } catch {}
  }

  async function handleRegisterProfile(e) {
    e.preventDefault()
    if (!newProfile.name.trim()) return
    setGeneratingProfiles(true)
    try {
      await api.registerCharacter(newProfile)
      setNewProfile({ name: '', description: '', lora_path: '' })
      await loadProfiles()
    } catch (e) {
      setError(e.message)
    } finally {
      setGeneratingProfiles(false)
    }
  }

  async function handleGenerateImages() {
    if (!selectedTemplate?.id) return
    setGenerating(true)
    setError(null)
    try {
      const data = await api.generateImages(selectedTemplate.id, sceneIndices, selectedCharacter?.name)
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function toggleScene(idx) {
    setSceneIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  return (
    <div className="content">
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Batch generation + scene selection */}
        <div>
          <div className="panel">
            <div className="panel-title mb-8">Batch Image Generation</div>
            <div className="panel-subtitle mb-16">
              Generate images for selected scenes using AI image models (SD or MiniMax image-01).
              {selectedTemplate && <span className="tag" style={{ marginLeft: 8 }}>{selectedTemplate.name}</span>}
            </div>

            {/* Character selector */}
            {profiles.length > 0 && (
              <div className="mb-16">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                  Character Profile
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-input"
                    style={{ flex: 1 }}
                    value={selectedCharacter || ''}
                    onChange={e => setSelectedCharacter(e.target.value ? profiles.find(p => p.id || p.name === e.target.value) : null)}
                  >
                    <option value="">— No character (generic generation) —</option>
                    {profiles.map(p => (
                      <option key={p.id || p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  {selectedCharacter && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedCharacter(null)}
                      title="Clear character"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {selectedCharacter && (
                  <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
                    ✓ Applying "{selectedCharacter.name}" to all scenes for visual consistency
                  </div>
                )}
              </div>
            )}

            {/* Scene selection */}
            {selectedTemplate?.scenes && (
              <div className="mb-16">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                  Select Scenes ({sceneIndices.length} selected)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedTemplate.scenes.map((scene, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sceneIndices.includes(i)}
                        onChange={() => toggleScene(i)}
                        style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{scene.scene_name || `Scene ${i + 1}`}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {scene.image_prompt_template || 'No prompt set'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{scene.duration}s</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!selectedTemplate && (
              <div className="empty-state">
                <p>Select a template to generate images for its scenes</p>
              </div>
            )}

            {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <button
              className="btn btn-primary w-full"
              onClick={handleGenerateImages}
              disabled={generating || sceneIndices.length === 0 || !selectedTemplate}
            >
              {generating ? <><div className="spinner" /> Generating...</> : `🖼️ Generate ${sceneIndices.length} Image${sceneIndices.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Character profiles */}
          <div className="panel mt-16">
            <div className="panel-title mb-8">Character Profiles (LoRA)</div>
            <div className="panel-subtitle mb-16">
              Register character profiles to maintain visual consistency across scenes.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {profiles.map((p, i) => (
                <div key={p.id || i} style={{ padding: '10px 12px', background: 'var(--color-surface-2)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  {p.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{p.description}</div>}
                  {p.lora_path && <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 2 }}>LoRA: {p.lora_path}</div>}
                </div>
              ))}
              {profiles.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No character profiles registered yet</div>}
            </div>

            <form onSubmit={handleRegisterProfile} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="form-input" placeholder="Character name (e.g., 'Host Alex')" value={newProfile.name} onChange={e => setNewProfile(p => ({ ...p, name: e.target.value }))} />
              <textarea className="form-input" placeholder="Character description (appearance, style, clothing...)" value={newProfile.description} onChange={e => setNewProfile(p => ({ ...p, description: e.target.value }))} rows={2} />
              <input className="form-input" placeholder="LoRA path (optional, leave empty for no LoRA)" value={newProfile.lora_path} onChange={e => setNewProfile(p => ({ ...p, lora_path: e.target.value }))} />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={!newProfile.name.trim() || generatingProfiles}>
                {generatingProfiles ? 'Registering...' : '+ Register Character'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Results */}
        <div>
          {results ? (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Generated Images</div>
                <span className="tag success">✓ {results.images?.length || results.results?.length || 0} images</span>
              </div>
              <div className="img-gen-grid">
                {(results.images || results.results || []).map((img, i) => (
                  <div key={i} className="img-card">
                    {img.url || img.image_url ? (
                      <img src={img.url || img.image_url} alt={`Scene ${i + 1}`} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🖼️</div>
                    )}
                    <div className="img-card-info">
                      <div className="img-card-name">{img.scene_name || `Scene ${(img.scene_index || i) + 1}`}</div>
                      {img.provider && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{img.provider}</div>}
                      {img.status && <span className={`tag ${img.status === 'success' ? 'success' : 'warning'}`}>{img.status}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="empty-state">
                <div className="empty-state-icon">🖼️</div>
                <h3>No images generated yet</h3>
                <p>Select scenes from a template and click "Generate Images" to create AI-generated visuals</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
