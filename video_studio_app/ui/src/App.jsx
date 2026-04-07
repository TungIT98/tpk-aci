import { useState, useEffect } from 'react'
import { api } from './api.js'
import TemplateEditor from './components/TemplateEditor.jsx'
import MusicBrowser from './components/MusicBrowser.jsx'
import BrollPicker from './components/BrollPicker.jsx'
import ScriptGenerator from './components/ScriptGenerator.jsx'
import ImageGenerator from './components/ImageGenerator.jsx'
import AssemblyPanel from './components/AssemblyPanel.jsx'

const TABS = [
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'broll', label: 'B-Roll', icon: '🎬' },
  { id: 'script', label: 'AI Script', icon: '✍️' },
  { id: 'images', label: 'Images', icon: '🖼️' },
  { id: 'assembly', label: 'Assembly', icon: '🎞️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('templates')
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')

  // Check API health on mount
  useEffect(() => {
    api.getHealth()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'))
  }, [])

  // Load templates when on templates tab
  useEffect(() => {
    if (activeTab === 'templates') loadTemplates()
  }, [activeTab])

  async function loadTemplates() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listTemplates()
      setTemplates(data.templates || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function selectTemplate(id) {
    setSelectedTemplateId(id)
    setLoading(true)
    try {
      const data = await api.getTemplate(id)
      setSelectedTemplate(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function renderTabContent() {
    if (apiStatus === 'error') {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3>API Unreachable</h3>
          <p>Start the SaaS API server:<br/><code>uvicorn video_studio_app.saas_api:app --reload --port 8000</code></p>
        </div>
      )
    }

    switch (activeTab) {
      case 'templates':
        return (
          <TemplateEditor
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={selectTemplate}
            onTemplatesChanged={loadTemplates}
            loading={loading}
          />
        )
      case 'music':
        return <MusicBrowser selectedTemplate={selectedTemplate} />
      case 'broll':
        return <BrollPicker selectedTemplate={selectedTemplate} />
      case 'script':
        return <ScriptGenerator selectedTemplate={selectedTemplate} />
      case 'images':
        return <ImageGenerator selectedTemplate={selectedTemplate} />
      case 'assembly':
        return <AssemblyPanel selectedTemplate={selectedTemplate} />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>🎬 Video Studio v3.0</h1>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: apiStatus === 'ok' ? 'var(--color-success)' : apiStatus === 'error' ? '#ef4444' : 'var(--color-warning)'
          }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {apiStatus === 'ok' ? 'API Connected' : apiStatus === 'error' ? 'API Offline' : 'Checking...'}
          </span>
        </div>
      </header>
      <main className="app-main">
        {renderTabContent()}
      </main>
    </div>
  )
}
