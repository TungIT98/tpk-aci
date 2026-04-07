/**
 * API client for Video Studio SaaS API (FastAPI on port 8000)
 */

const BASE = '/api'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Templates ────────────────────────────────────────────────────────────────

export const api = {
  // Templates
  listTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (data) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  patchScene: (templateId, sceneIdx, data) =>
    request(`/templates/${templateId}/scenes/${sceneIdx}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addScene: (templateId, data) =>
    request(`/templates/${templateId}/scenes`, { method: 'POST', body: JSON.stringify(data) }),
  removeScene: (templateId, sceneIdx) =>
    request(`/templates/${templateId}/scenes/${sceneIdx}`, { method: 'DELETE' }),
  moveScene: (templateId, sceneIdx, direction) =>
    request(`/templates/${templateId}/scenes/${sceneIdx}/move?direction=${direction}`, { method: 'POST' }),
  reorderScenes: (templateId, newOrder) =>
    request(`/templates/${templateId}/scenes/reorder`, { method: 'POST', body: JSON.stringify({ new_order: newOrder }) }),
  cloneTemplate: (templateId, newId, newName) =>
    request(`/templates/${templateId}/clone`, { method: 'POST', body: JSON.stringify({ new_id: newId, new_name: newName }) }),
  saveAsNew: (templateId, newId) =>
    request(`/templates/${templateId}/save-as-new`, { method: 'POST', body: JSON.stringify({ new_id: newId }) }),
  exportTemplateJson: (templateId) => request(`/templates/${templateId}/export`),
  importTemplateJson: (data) => request('/templates/import', { method: 'POST', body: JSON.stringify(data) }),

  // Scene preview
  getScenePreview: (templateId, sceneIdx) => request(`/templates/${templateId}/scenes/${sceneIdx}/preview`),
  getAllScenePreviews: (templateId) => request(`/templates/${templateId}/scenes/previews`),

  // Music
  listMusic: (mood) => request(`/music${mood ? `?mood=${mood}` : ''}`),
  suggestMusic: (templateId) => request(`/music/suggest/${templateId}`),
  suggestMusicForMood: (mood, duration) => request(`/music/suggest?mood=${mood}&duration=${duration}`),
  getSceneVolumeArc: (templateId) => request(`/music/scene-volumes/${templateId}`),

  // B-roll
  searchBroll: (query, page = 1) => request(`/broll/search?q=${encodeURIComponent(query)}&page=${page}`),
  suggestBroll: (templateId, sceneIdx) => request(`/broll/suggest/${templateId}/${sceneIdx}`),

  // Script generation
  generateScript: (topic) => request('/script/generate', { method: 'POST', body: JSON.stringify({ topic }) }),
  generateStoryboard: (topic) => request('/script/storyboard', { method: 'POST', body: JSON.stringify({ topic }) }),

  // Image generation
  generateImages: (templateId, sceneIndices, characterName) =>
    request('/images/generate-for-template', {
      method: 'POST',
      body: JSON.stringify({
        template_id: templateId,
        scene_indices: sceneIndices,
        character_name: characterName || null,
      }),
    }),
  getCharacterProfiles: () => request('/images/character-profiles'),
  registerCharacter: (profile) => request('/images/character-profiles', { method: 'POST', body: JSON.stringify(profile) }),

  // Assembly / preview
  getAssemblyStatus: () => request('/assembly/status'),
  assemblePreview: (templateId) =>
    request('/assembly/preview', { method: 'POST', body: JSON.stringify({ template_id: templateId }) }),
  getAssemblyProgress: (jobId) => request(`/assembly/progress/${jobId}`),
  getQualityPresets: () => request('/assembly/presets'),

  // Color grading
  getColorPresets: () => request('/color-grading/presets'),
  applyColorGrade: (data) =>
    request('/color-grading/apply', { method: 'POST', body: JSON.stringify(data) }),
  getColorGradeStatus: (jobId) => request(`/color-grading/status/${jobId}`),

  // QC gates
  runQCGate: (data) =>
    request('/qc/gate', { method: 'POST', body: JSON.stringify(data) }),
  runQCGateGET: (videoPath, platform = 'youtube', blockingOnly = false) =>
    request(`/qc/gate/${encodeURIComponent(videoPath)}?platform=${platform}&blocking_only=${blockingOnly}`),

  // Analytics / health
  getHealth: () => request('/analytics/health'),
  getModuleStatus: () => request('/analytics/modules'),
}
