import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ragQuery } from '@/lib/rag'

// POST /api/chat — ask a question 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, documentId, chatId } = body

    // 1. Validate inputs 
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required.' }, { status: 400 })
    }
    if (!documentId || !chatId) {
      return NextResponse.json({ error: 'documentId and chatId are required.' }, { status: 400 })
    }
    if (question.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Question is too long. Keep it under 2000 characters.' },
        { status: 400 }
      )
    }

    // 2. Verify the chat session exists and belongs to that document 
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { documentId: true },
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat session not found.' }, { status: 404 })
    }
    if (chat.documentId !== documentId) {
      return NextResponse.json({ error: 'Chat does not belong to this document.' }, { status: 403 })
    }

    // 3. Run the RAG pipeline 
    // retrieveRelevantChunks → generateAnswer → persist both messages
    const { answer, sources } = await ragQuery(
      question.trim(),
      documentId,
      chatId
    )

    return NextResponse.json({ answer, sources })

  } catch (err: unknown) {
    console.error('[chat POST] error:', err)
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/chat?chatId=xxx — load message history 
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId')

    if (!chatId) {
      return NextResponse.json({ error: 'chatId query param is required.' }, { status: 400 })
    }

    // 1. Verify the chat exists 
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        id:         true,
        createdAt:  true,
        documentId: true,
        document:   { select: { filename: true } },
      },
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat session not found.' }, { status: 404 })
    }

    // 2. Fetch messages ordered oldest → newest 
    const messages = await prisma.message.findMany({
      where:   { chatId },
      orderBy: { createdAt: 'asc' },
      select: {
        id:        true,
        role:      true,
        content:   true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      chat: {
        id:        chat.id,
        createdAt: chat.createdAt,
        document: {
          id:       chat.documentId,
          filename: chat.document.filename,
        },
      },
      messages,
    })

  } catch (err: unknown) {
    console.error('[chat GET] error:', err)
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}