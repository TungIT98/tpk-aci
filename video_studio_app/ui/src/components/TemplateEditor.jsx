import { useState, useEffect } from 'react'
import { api } from '../api.js'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  KeyboardSensor
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Sortable Scene Card ──────────────────────────────────────────────────────

function SortableScene({ scene, index, templateId, onRemove }) {
  const [editing, setEditing] = useState(null)
  const [durationVal, setDurationVal] = useState(scene.duration)
  const [saving, setSaving] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `scene-${index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  async function saveDuration() {
    setSaving(true)
    try {
      await api.patchScene(templateId, index, { duration: parseFloat(durationVal) })
      setEditing(null)
    } catch {
      // silent fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={`scene-card${isDragging ? ' dragging' : ''}`}>
      <div className="scene-drag-handle" {...attributes} {...listeners} title="Drag to reorder">☰</div>
      <div className="scene-info">
        <div className="scene-name">{scene.scene_name || `Scene ${index + 1}`}</div>
        <div className="scene-meta">
          {scene.shot_type && <span className="tag">{scene.shot_type}</span>}
          {scene.camera_movement && <span className="tag">{scene.camera_movement}</span>}
          {scene.transition && <span className="tag accent">{scene.transition}</span>}
        </div>
      </div>
      <div className="scene-duration">
        {editing === 'duration' ? (
          <input
            value={durationVal}
            onChange={e => setDurationVal(e.target.value)}
            onBlur={saveDuration}
            onKeyDown={e => { if (e.key === 'Enter') saveDuration() }}
            autoFocus
            disabled={saving}
          />
        ) : (
          <span
            style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)', minWidth: 40 }}
            onClick={() => setEditing('duration')}
            title="Click to edit duration"
          >
            {scene.duration}s ⏱️
          </span>
        )}
      </div>
      <div className="scene-actions">
        <button className="icon-btn danger" onClick={() => onRemove(index)} title="Remove scene">✕</button>
      </div>
    </div>
  )
}

// ── Template Editor ──────────────────────────────────────────────────────────

export default function TemplateEditor({ templates, selectedTemplate, onSelectTemplate, onTemplatesChanged, loading }) {
  const [view, setView] = useState('list')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [exportData, setExportData] = useState(null)
  const [importText, setImportText] = useState('')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [cloning, setCloning] = useState(false)
  const [addSceneLoading, setAddSceneLoading] = useState(false)
  const [previews, setPreviews] = useState([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!selectedTemplate?.id) return
    api.getAllScenePreviews(selectedTemplate.id)
      .then(data => setPreviews(data.previews || []))
      .catch(() => setPreviews([]))
  }, [selectedTemplate?.id])

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedTemplate) return
    const oldIdx = parseInt(active.id.replace('scene-', ''))
    const newIdx = parseInt(over.id.replace('scene-', ''))
    const scenes = selectedTemplate.scenes || []
    const newOrder = arrayMove(
      scenes.map((_, i) => i),
      oldIdx, newIdx
    )
    saveReorder(newOrder)
  }

  async function saveReorder(newOrder) {
    setSaving(true)
    try {
      const updated = await api.reorderScenes(selectedTemplate.id, newOrder)
      onSelectTemplate(updated.template?.id || selectedTemplate.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Scene operations ──────────────────────────────────────────────────────

  async function handleRemoveScene(idx) {
    if (!selectedTemplate) return
    setSaving(true)
    try {
      const updated = await api.removeScene(selectedTemplate.id, idx)
      onSelectTemplate(updated.template?.id || selectedTemplate.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddScene() {
    if (!selectedTemplate) return
    setAddSceneLoading(true)
    try {
      const updated = await api.addScene(selectedTemplate.id, {
        scene_name: 'New Scene',
        duration: 5,
        image_prompt_template: 'A professional studio setup',
        voiceover_template: '',
        transition: 'cut',
      })
      onSelectTemplate(updated.template?.id || selectedTemplate.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setAddSceneLoading(false)
    }
  }

  async function handleMoveScene(idx, direction) {
    if (!selectedTemplate) return
    try {
      const updated = await api.moveScene(selectedTemplate.id, idx, direction)
      onSelectTemplate(updated.template?.id || selectedTemplate.id)
    } catch (e) {
      setError(e.message)
    }
  }

  // ── Clone / export / import ──────────────────────────────────────────────

  async function handleClone() {
    if (!selectedTemplate || !newTemplateName.trim()) return
    setCloning(true)
    try {
      const newId = `tmpl_${Date.now()}`
      await api.cloneTemplate(selectedTemplate.id, newId, newTemplateName.trim())
      setNewTemplateName('')
      await onTemplatesChanged()
      const list = await api.listTemplates()
      const cloned = (list.templates || []).find(t => t.id === newId)
      if (cloned) onSelectTemplate(cloned.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setCloning(false)
    }
  }

  async function handleExport() {
    if (!selectedTemplate) return
    try {
      const data = await api.exportTemplateJson(selectedTemplate.id)
      setExportData(JSON.stringify(data, null, 2))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleImport() {
    if (!importText.trim()) return
    try {
      const data = JSON.parse(importText)
      const result = await api.importTemplateJson(data)
      await onTemplatesChanged()
      if (result.template?.id) onSelectTemplate(result.template.id)
      setImportText('')
      setView('list')
    } catch (e) {
      setError('Invalid JSON: ' + e.message)
    }
  }

  async function handleSaveAsNew() {
    if (!selectedTemplate) return
    const newId = `tmpl_${Date.now()}`
    try {
      const updated = await api.saveAsNew(selectedTemplate.id, newId)
      await onTemplatesChanged()
      if (updated.template?.id) onSelectTemplate(updated.template.id)
    } catch (e) {
      setError(e.message)
    }
  }

  // ── Editor view ──────────────────────────────────────────────────────────

  if (view === 'editor' && selectedTemplate) {
    const scenes = selectedTemplate.scenes || []
    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">{selectedTemplate.name}</div>
                <div className="panel-subtitle">{selectedTemplate.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setView('list')}>← Back</button>
                <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export JSON</button>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveAsNew}>Save as New</button>
                <button className="btn btn-primary btn-sm" onClick={handleAddScene} disabled={addSceneLoading}>
                  {addSceneLoading ? '...' : '+ Add Scene'}
                </button>
              </div>
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {scenes.length} scenes • Total: {scenes.reduce((s, sc) => s + (sc.duration || 0), 0)}s
              </span>
              {saving && <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>Saving...</span>}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={scenes.map((_, i) => `scene-${i}`)} strategy={verticalListSortingStrategy}>
                <div className="scene-list">
                  {scenes.map((scene, i) => (
                    <SortableScene
                      key={`scene-${i}`}
                      scene={scene}
                      index={i}
                      templateId={selectedTemplate.id}
                      onRemove={handleRemoveScene}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {scenes.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🎬</div>
                <h3>No scenes yet</h3>
                <p>Click "+ Add Scene" to start building your template</p>
              </div>
            )}
          </div>

          {exportData && (
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Exported Template JSON</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setExportData(null)}>✕</button>
              </div>
              <textarea
                readOnly
                value={exportData}
                style={{ width: '100%', minHeight: 200, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, color: 'var(--color-text)', fontSize: 11, fontFamily: 'monospace' }}
              />
              <button className="btn btn-primary btn-sm mt-8" onClick={() => { navigator.clipboard.writeText(exportData) }}>
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Right preview panel */}
        <div className="preview-panel">
          <div className="preview-panel-header">
            <h3>Scene Preview</h3>
          </div>
          <div className="preview-content">
            {scenes.map((scene, i) => (
              <div key={i} className="preview-scene">
                <div className="preview-scene-label">SCENE {i + 1} — {scene.duration}s</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  {scene.shot_type && <span className="tag" style={{ marginRight: 4 }}>{scene.shot_type}</span>}
                  {scene.transition && <span className="tag accent">{scene.transition}</span>}
                </div>
                {scene.image_prompt_template && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    🎨 {scene.image_prompt_template}
                  </div>
                )}
                {scene.voiceover_template && (
                  <div style={{ fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                    🎙️ {scene.voiceover_template}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="sidebar">
        <div className="sidebar-section">
          <h3>Templates ({templates.length})</h3>
          <div className="template-list">
            {templates.map(t => (
              <div
                key={t.id}
                className={`template-item${selectedTemplate?.id === t.id ? ' active' : ''}`}
                onClick={() => onSelectTemplate(t.id)}
              >
                <div className="template-item-icon">🎬</div>
                <div className="template-item-info">
                  <div className="template-item-name">{t.name}</div>
                  <div className="template-item-meta">{t.scenes?.length || 0} scenes</div>
                </div>
              </div>
            ))}
            {loading && <div style={{ padding: 12, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          </div>
        </div>
        <div className="sidebar-section">
          <h3>Import JSON</h3>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste template JSON here..."
            style={{ width: '100%', minHeight: 80, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 8, color: 'var(--color-text)', fontSize: 11, fontFamily: 'monospace', resize: 'none' }}
          />
          <button className="btn btn-primary btn-sm w-full mt-8" onClick={handleImport} disabled={!importText.trim()}>
            Import Template
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {selectedTemplate ? (
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">{selectedTemplate.name}</div>
                <div className="panel-subtitle">{selectedTemplate.description}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={handleExport}>Export</button>
                <button className="btn btn-primary" onClick={() => setView('editor')}>Open Editor →</button>
              </div>
            </div>
            <div className="panel-title mt-16 mb-8">Clone Template</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="topic-input"
                placeholder="New template name..."
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleClone() }}
              />
              <button className="btn btn-primary" onClick={handleClone} disabled={!newTemplateName.trim() || cloning}>
                {cloning ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>Select a Template</h3>
            <p>Choose a template from the sidebar to edit it</p>
          </div>
        )}
      </div>
    </div>
  )
}
