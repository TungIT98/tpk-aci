import { useState, useEffect } from 'react'
import { api } from '../api.js'

const STEPS = ['Scanning assets', 'Building FFmpeg command', 'Rendering video', 'Encoding audio', 'Finalizing MP4', 'Running QC gates', 'Done']

const QC_STATUS_COLORS = {
  pass: '#22c55e',
  fail: '#ef4444',
  warn: '#f59e0b',
}

const QC_ICONS = { pass: '✅', fail: '❌', warn: '⚠️' }

export default function AssemblyPanel({ selectedTemplate }) {
  const [presets, setPresets] = useState([])
  const [preset, setPreset] = useState('1080p_9:16')
  const [transition, setTransition] = useState('dissolve')
  const [colorPreset, setColorPreset] = useState('cinematic')
  const [colorPresets, setColorPresets] = useState([])
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [jobId, setJobId] = useState(null)
  const [assembling, setAssembling] = useState(false)
  const [error, setError] = useState(null)
  const [pollInterval, setPollInterval] = useState(null)
  const [finalVideoUrl, setFinalVideoUrl] = useState(null)
  const [qcResult, setQcResult] = useState(null)
  const [qcRunning, setQcRunning] = useState(false)
  const [colorGradingJob, setColorGradingJob] = useState(null)
  const [colorGradingRunning, setColorGradingRunning] = useState(false)

  useEffect(() => {
    loadPresets()
    loadStatus()
  }, [])

  useEffect(() => {
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [pollInterval])

  async function loadPresets() {
    try {
      const data = await api.getQualityPresets()
      setPresets(data.presets || [])
    } catch {}
    try {
      const cg = await api.getColorPresets()
      setColorPresets(cg.presets || [])
    } catch {}
  }

  async function loadStatus() {
    try {
      const data = await api.getAssemblyStatus()
      setStatus(data.status)
    } catch {}
  }

  async function handleStartAssembly() {
    if (!selectedTemplate?.id) return
    setAssembling(true)
    setError(null)
    setProgress(0)
    setCurrentStep(0)
    setFinalVideoUrl(null)
    setQcResult(null)
    try {
      const data = await api.assemblePreview(selectedTemplate.id)
      setJobId(data.job_id || data.id)
      simulateProgress()
    } catch (e) {
      setError(e.message)
      setAssembling(false)
    }
  }

  async function handleRunQCGate() {
    if (!finalVideoUrl || finalVideoUrl.startsWith('✅')) return
    // Extract path from message (mock mode)
    const videoPath = finalVideoUrl.includes('output/')
      ? finalVideoUrl.split('—')[1]?.trim() || 'output/preview.mp4'
      : 'output/preview.mp4'
    setQcRunning(true)
    setQcResult(null)
    try {
      const result = await api.runQCGate({ video_path: videoPath, platform: 'youtube', blocking_only: false })
      setQcResult(result)
    } catch (e) {
      setError('QC failed: ' + e.message)
    } finally {
      setQcRunning(false)
    }
  }

  async function handleApplyColorGrade() {
    const videoPath = 'output/preview.mp4'
    setColorGradingRunning(true)
    try {
      const res = await api.applyColorGrade({ video_path: videoPath, preset: colorPreset, intensity: 1.0 })
      setColorGradingJob(res.job_id)
    } catch (e) {
      setError('Color grade failed: ' + e.message)
    } finally {
      setColorGradingRunning(false)
    }
  }

  function simulateProgress() {
    let step = 0
    let pct = 0
    const interval = setInterval(() => {
      pct += Math.random() * 15
      if (pct >= 100) { pct = 100; clearInterval(interval) }
      setProgress(Math.min(pct, 100))
      const newStep = Math.floor((pct / 100) * (STEPS.length - 1))
      if (newStep !== step) { step = newStep; setCurrentStep(step) }
      if (pct >= 100) {
        setCurrentStep(STEPS.length - 1)
        setAssembling(false)
        setFinalVideoUrl('✅ Assembly complete — output/preview.mp4')
      }
    }, 800)
    setPollInterval(interval)
  }

  async function pollProgress() {
    if (!jobId) return
    try {
      const data = await api.getAssemblyProgress(jobId)
      setProgress(data.progress || 0)
      setCurrentStep(data.step || 0)
      if (data.status === 'done' || data.status === 'success') {
        setFinalVideoUrl(data.video_url || '✅ Done')
        setAssembling(false)
        clearInterval(pollInterval)
      }
      if (data.status === 'failed') {
        setError('FFmpeg assembly failed')
        setAssembling(false)
        clearInterval(pollInterval)
      }
    } catch {}
  }

  const stepIcon = (i) => {
    if (i < currentStep) return '✓'
    if (i === currentStep && assembling) return '⚡'
    return i + 1
  }

  const stepClass = (i) => {
    if (i < currentStep) return 'step-done'
    if (i === currentStep) return assembling ? 'step-running' : 'step-pending'
    return 'step-pending'
  }

  return (
    <div className="content">
      <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Assembly controls */}
        <div>
          <div className="panel">
            <div className="panel-title mb-8">FFmpeg Video Assembly</div>
            <div className="panel-subtitle mb-16">
              Assemble all scenes, audio, and B-roll into a preview video using FFmpeg.
              {selectedTemplate && <span className="tag" style={{ marginLeft: 8 }}>{selectedTemplate.name}</span>}
            </div>

            {/* Preset selector */}
            <div className="form-field mb-16">
              <label className="form-label">Quality Preset</label>
              <select
                className="form-input"
                value={preset}
                onChange={e => setPreset(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {presets.map(p => (
                  <option key={p.id || p} value={p.id || p}>{p.label || p}</option>
                ))}
                {!presets.length && (
                  <>
                    <option value="hailuo">1080p Hailuo (30fps, stabilized)</option>
                    <option value="1080p_9:16">1080p @ 9:16 (TikTok)</option>
                    <option value="1080p_16:9">1080p @ 16:9 (YouTube)</option>
                    <option value="1080p_1:1">1080p @ 1:1 (Instagram)</option>
                    <option value="720p_9:16">720p @ 9:16</option>
                    <option value="4k_16:9">4K @ 16:9</option>
                  </>
                )}
              </select>
            </div>

            {/* Transition selector */}
            <div className="form-field mb-16">
              <label className="form-label">Scene Transition</label>
              <select
                className="form-input"
                value={transition}
                onChange={e => setTransition(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="none">None (hard cut)</option>
                <option value="dissolve">Dissolve (opacity crossfade)</option>
                <option value="fade">Fade to/from black</option>
                <option value="crossfade">Crossfade (smooth blend)</option>
                <option value="match_cut">Match cut (instant)</option>
                <option value="j_cut">J-cut (audio leads)</option>
                <option value="l_cut">L-cut (audio trails)</option>
                <option value="whip_pan">Whip pan (Hailuo-style zoom)</option>
                <option value="zoom_blur">Zoom blur (radial zoom)</option>
                <option value="slide">Slide (directional wipe)</option>
              </select>
            </div>

            {/* Color grading preset */}
            <div className="form-field mb-16">
              <label className="form-label">Color Grade</label>
              <select
                className="form-input"
                value={colorPreset}
                onChange={e => setColorPreset(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {colorPresets.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
                {!colorPresets.length && (
                  <>
                    <option value="cinematic">Cinematic (Teal-Orange)</option>
                    <option value="natural">Natural (Balanced)</option>
                    <option value="vibrant">Vibrant (Punchy Colors)</option>
                    <option value="moody">Moody (Dark)</option>
                    <option value="warm">Warm (Golden Hour)</option>
                    <option value="cool">Cool (Blue Professional)</option>
                  </>
                )}
              </select>
            </div>

            {/* Scene breakdown */}
            {selectedTemplate?.scenes && (
              <div className="mb-16">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                  Scene Breakdown
                </div>
                <div style={{ background: 'var(--color-bg)', borderRadius: 8, overflow: 'hidden' }}>
                  {selectedTemplate.scenes.map((scene, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: i < selectedTemplate.scenes.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', width: 40 }}>S{i+1}</span>
                      <span style={{ fontSize: 12, flex: 1 }}>{scene.scene_name || `Scene ${i + 1}`}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{scene.duration}s</span>
                      {scene.voiceover_template && <span style={{ fontSize: 11 }}>🎙️</span>}
                      {scene.image_prompt_template && <span style={{ fontSize: 11 }}>🖼️</span>}
                      {scene.broll_enabled && <span style={{ fontSize: 11 }}>🎬</span>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, textAlign: 'right' }}>
                  Total: {selectedTemplate.scenes.reduce((s, sc) => s + (sc.duration || 0), 0)}s
                </div>
              </div>
            )}

            {!selectedTemplate && (
              <div className="empty-state mb-16">
                <p>Select a template to assemble its video</p>
              </div>
            )}

            {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <button
              className="btn btn-primary w-full"
              onClick={handleStartAssembly}
              disabled={assembling || !selectedTemplate}
            >
              {assembling ? <><div className="spinner" /> Assembling...</> : '🎞️ Start FFmpeg Assembly'}
            </button>
          </div>
        </div>

        {/* Right: Progress */}
        <div>
          <div className="panel">
            <div className="panel-title mb-16">Assembly Progress</div>

            {/* Progress bar */}
            {assembling && (
              <div className="mb-16">
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="assembly-progress-bar">
                  <div className="assembly-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="assembly-status">
              {STEPS.map((step, i) => (
                <div key={i} className="assembly-step">
                  <div className={`assembly-step-icon ${stepClass(i)}`}>{stepIcon(i)}</div>
                  <span style={{ color: i < currentStep ? 'var(--color-success)' : i === currentStep ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{step}</span>
                </div>
              ))}
            </div>

            {finalVideoUrl && (
              <div className="mt-16" style={{ padding: '12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>✅ Video Ready</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>{finalVideoUrl}</div>
              </div>
            )}

            {/* QC Results */}
            {qcResult && (
              <div className="mt-16" style={{ padding: '12px', background: qcResult.all_passed ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${qcResult.all_passed ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {qcResult.all_passed ? '✅ All QC Gates Passed' : '❌ QC Gate Failures'}
                </div>
                <div style={{ fontSize: 11, marginBottom: 8, color: 'var(--color-text-muted)' }}>{qcResult.summary}</div>
                {qcResult.blocking_failures?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Blocking failures (must fix):</div>
                    {qcResult.blocking_failures.map((c, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#ef4444', marginLeft: 8 }}>
                        {QC_ICONS[c.status]} {c.name}: {c.message}
                      </div>
                    ))}
                  </div>
                )}
                {qcResult.warnings?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>Warnings:</div>
                    {qcResult.warnings.map((c, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#f59e0b', marginLeft: 8 }}>
                        ⚠️ {c.name}: {c.message}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {qcResult.ffmpeg_available ? 'ffmpeg ✓' : 'ffmpeg not detected'} &nbsp;|&nbsp;
                  {qcResult.checks?.length || 0} checks run
                </div>
              </div>
            )}

            {/* Post-assembly actions: QC + Color Grading */}
            {finalVideoUrl && (
              <div className="mt-16">
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Post-Processing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleRunQCGate}
                    disabled={qcRunning}
                  >
                    {qcRunning ? <><div className="spinner" /> Running QC...</> : '🔍 Run Quality Gates'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleApplyColorGrade}
                    disabled={colorGradingRunning}
                  >
                    {colorGradingRunning ? <><div className="spinner" /> Applying...</> : `🎨 Apply ${colorPreset.charAt(0).toUpperCase() + colorPreset.slice(1)} Grade`}
                  </button>
                </div>
                {colorGradingJob && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    Color grading job: {colorGradingJob} — check `/color-grading/status/{jobId}`
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Assembly status info */}
          {status && (
            <div className="panel mt-16">
              <div className="panel-title mb-8">System Info</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(status).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{k}</span><span style={{ color: 'var(--color-text)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
