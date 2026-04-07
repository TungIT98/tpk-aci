import { useState } from 'react'
import { api } from '../api.js'

export default function ScriptGenerator({ selectedTemplate }) {
  const [topic, setTopic] = useState('')
  const [script, setScript] = useState(null)
  const [storyboard, setStoryboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerateScript(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateScript(topic.trim())
      setScript(data)
      setStoryboard(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateStoryboard(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateStoryboard(topic.trim())
      setStoryboard(data)
      setScript(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyToTemplate() {
    if (!storyboard?.scenes || !selectedTemplate?.id) return
    // For each scene in the storyboard, update the corresponding template scene
    for (let i = 0; i < Math.min(storyboard.scenes.length, selectedTemplate.scenes.length); i++) {
      const sbScene = storyboard.scenes[i]
      try {
        await api.patchScene(selectedTemplate.id, i, {
          voiceover_template: sbScene.voiceover_text || sbScene.voiceover,
          image_prompt_template: sbScene.image_prompt || sbScene.visual_description,
          text_overlay_template: sbScene.text_overlay || sbScene.on_screen_text,
        })
      } catch {}
    }
    setError(null)
  }

  return (
    <div className="content">
      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Input */}
        <div>
          <div className="panel">
            <div className="panel-title mb-8">AI Script Generator</div>
            <div className="panel-subtitle mb-16">
              Enter a topic and generate a full video script with scene breakdown.
              {selectedTemplate && <span className="tag success" style={{ marginLeft: 8 }}>Template: {selectedTemplate.name}</span>}
            </div>

            <form onSubmit={handleGenerateScript} className="script-generator">
              <div className="form-field">
                <label className="form-label">Video Topic</label>
                <textarea
                  className="form-input"
                  placeholder="e.g., '5 productivity tips for remote workers' or 'How to make perfect pour-over coffee'"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary flex-1" disabled={loading || !topic.trim()}>
                  {loading ? <div className="spinner" /> : '✍️ Generate Script'}
                </button>
                <button type="button" className="btn btn-secondary flex-1" onClick={handleGenerateStoryboard} disabled={loading || !topic.trim()}>
                  {loading ? <div className="spinner" /> : '🎬 Generate Storyboard'}
                </button>
              </div>
            </form>

            {/* Apply to template */}
            {storyboard?.scenes && selectedTemplate && (
              <div className="mt-16" style={{ padding: '12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ready to apply to template?</div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  This will update {Math.min(storyboard.scenes.length, selectedTemplate.scenes?.length || 0)} scenes in "{selectedTemplate.name}" with voiceover text, image prompts, and on-screen text.
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleApplyToTemplate}>
                  Apply Storyboard to Template →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div>
          {script ? (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Generated Script</div>
                <span className="tag success">✓ Ready</span>
              </div>
              <div className="storyboard-preview">
                {script.scenes?.map((scene, i) => (
                  <div key={i} className="storyboard-scene">
                    <div className="storyboard-scene-num">SCENE {i + 1} — {scene.duration || scene.duration_s || '?'}s</div>
                    {scene.shot_type && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>🎥 {scene.shot_type}</div>}
                    {scene.voiceover && <div style={{ fontSize: 12, marginBottom: 4 }}>🎙️ {scene.voiceover}</div>}
                    {scene.visual && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>🖼️ {scene.visual}</div>}
                    {scene.on_screen_text && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-accent)' }}>✍️ {scene.on_screen_text}</div>}
                    {scene.text && <div className="storyboard-scene-text">{scene.text}</div>}
                  </div>
                ))}
                {!script.scenes && (
                  <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {typeof script === 'string' ? script : JSON.stringify(script, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ) : storyboard ? (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Storyboard</div>
                <span className="tag success">✓ {storyboard.scenes?.length || 0} scenes</span>
              </div>
              <div className="storyboard-preview">
                {storyboard.scenes?.map((scene, i) => (
                  <div key={i} className="storyboard-scene">
                    <div className="storyboard-scene-num">SCENE {i + 1}</div>
                    <div style={{ fontSize: 12, marginBottom: 4, fontWeight: 600 }}>🎬 {scene.scene_name || `Scene ${i + 1}`}</div>
                    {scene.description && <div style={{ fontSize: 12, marginBottom: 4 }}>{scene.description}</div>}
                    {scene.voiceover_text && <div style={{ fontSize: 12, marginBottom: 4 }}>🎙️ {scene.voiceover_text}</div>}
                    {scene.voiceover && <div style={{ fontSize: 12, marginBottom: 4 }}>🎙️ {scene.voiceover}</div>}
                    {scene.image_prompt && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>🖼️ {scene.image_prompt}</div>}
                    {scene.visual_description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>🖼️ {scene.visual_description}</div>}
                    {scene.on_screen_text && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--color-accent)' }}>✍️ {scene.on_screen_text}</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="empty-state">
                <div className="empty-state-icon">✍️</div>
                <h3>No script yet</h3>
                <p>Enter a topic and click Generate Script or Generate Storyboard</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
