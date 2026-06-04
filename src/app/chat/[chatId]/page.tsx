'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ChatSession {
  id: string
  createdAt: string
  document: { id: string; filename: string }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export default function ChatPage() {
  const params = useParams()
  const chatId = params.chatId as string

  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat session & messages on mount
  useEffect(() => {
    fetchChat()
  }, [chatId])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchChat() {
    try {
      setError(null)
      const res = await fetch(`/api/chat?chatId=${chatId}`)
      if (!res.ok) throw new Error('Failed to load chat.')
      const data = await res.json()
      setSession(data.chat)
      setMessages(data.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !session) return

    const question = input.trim()
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          documentId: session.document.id,
          chatId: session.id,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message.')
      }

      const data = await res.json()
      
      // Add both user and assistant messages to the list
      setMessages(prev => [
        ...prev,
        { id: '1', role: 'user', content: question, createdAt: new Date().toISOString() },
        { id: '2', role: 'assistant', content: data.answer, createdAt: new Date().toISOString() },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.')
      setInput(question) // Restore input on error
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <main className="chat-shell">
        <div className="chat-header">
          <div style={{ height: 20, background: 'rgba(148,163,184,0.15)', borderRadius: 4, maxWidth: 220, margin: '0 auto', animation: 'pulse 1.4s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </main>
    )
  }

  if (error || !session) {
    return (
      <main className="container">
        <div className="alert">
          <span style={{ fontSize: 18 }}>⚠</span>
          {error || 'Chat not found.'}
        </div>
        <Link href="/" className="button-secondary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
          ← Back to home
        </Link>
      </main>
    )
  }

  return (
    <main className="chat-shell">
      <div className="chat-header">
        <div>
          <h1 className="chat-title">{session.document.filename}</h1>
          <p className="chat-meta">Chat ID: {session.id.substring(0, 8)}…</p>
        </div>
        <Link href="/" className="button-secondary">
          ← Home
        </Link>
      </div>

      <div className="chat-window">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
            <p style={{ fontSize: 14 }}>No messages yet. Ask a question to get started!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div className={`message ${msg.role}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-panel">
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about the PDF…"
            disabled={sending}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="chat-submit"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </main>
  )
}
