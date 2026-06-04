'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Document {
  id: string
  filename: string
  uploadedAt: string
  chats: { id: string }[]
}

export default function HomePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    try {
      setError(null)
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error('Failed to load documents.')
      const data = await res.json()
      setDocuments(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This will also remove all its chats.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed.')
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="container">
        <div className="list-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: 72, animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="container">
        <div className="alert">
          <span style={{ fontSize: 18 }}>⚠</span>
          <span>{error}</span>
          <button onClick={fetchDocuments} className="button-secondary">Retry</button>
        </div>
      </main>
    )
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <main className="container">
      <div className="panel" style={{ padding: 28 }}>
        <div className="header">
          <div className="title-group">
            <h1>PDF Chatbot</h1>
            <p>
              {documents.length === 0
                ? 'No documents yet'
                : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link href="/upload" className="button-primary">
            + Upload PDF
          </Link>
        </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="empty-state section card">
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-muted)' }}>Upload a PDF to start chatting with it.</p>
          <Link href="/upload" className="button-primary">
            Upload your first PDF
          </Link>
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="section list-grid">
          {documents.map(doc => {
            const chatId = doc.chats[0]?.id
            const isDeleting = deleting === doc.id

            return (
              <div key={doc.id} className="list-item" style={{ opacity: isDeleting ? 0.5 : 1 }}>

                <div className="icon-box">📄</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="document-title">{doc.filename}</p>
                  <p className="document-meta">{formatDate(doc.uploadedAt)}</p>
                </div>

                <div className="action-row">
                  {chatId ? (
                    <Link href={`/chat/${chatId}`} className="button-secondary" style={{ padding: '8px 16px' }}>
                      Chat
                    </Link>
                  ) : (
                    <span className="button-secondary" style={{ padding: '8px 16px' }}>
                      No chat
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    disabled={isDeleting}
                    className="button-secondary"
                    style={{ padding: '8px 14px' }}
                    title="Delete document"
                  >
                    {isDeleting ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </main>
  )
}