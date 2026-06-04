import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedText, formatVector } from "./embeddings";
import { prisma } from "./db";

// Initialize Gemini model only if key and real embeddings are enabled
// Falls back to mock answer if API is unavailable
let flashModel: any = null
if (process.env.GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  } catch (err) {
    console.warn('[rag] Failed to initialize Gemini model, will use mock responses')
  }
}

export interface RelevantChunk {
    id: string
    content: string
    similarity: number
}

export interface RAGResult {
    answer: string
    sources: RelevantChunk[]
}

export async function retrieveRelevantChunks(
  question: string,
  documentId: string,
  topK = 5
): Promise<RelevantChunk[]> {
  const questionEmbedding = await embedText(question)
  const vectorLiteral = formatVector(questionEmbedding)

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM "Chunk"
     WHERE "documentId" = $2
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorLiteral,
    documentId,
    topK
  ) as { id: string; content: string; similarity: number }[]

  if (rows.length > 0) {
    return rows
  }

  return await fallbackTextSearch(question, documentId, topK)
}

async function fallbackTextSearch(
  question: string,
  documentId: string,
  topK: number
): Promise<RelevantChunk[]> {
  const queryTerms = new Set(
    Array.from(question.toLowerCase().matchAll(/\p{L}+/gu), (m) => m[0])
      .filter((token) => token.length > 2)
  )

  if (queryTerms.size === 0) {
    return []
  }

  const chunks = await prisma.chunk.findMany({
    where: { documentId },
    select: { id: true, content: true },
  })

  const scored = chunks
    .map((chunk) => {
      const contentTerms = new Set(
        Array.from(chunk.content.toLowerCase().matchAll(/\p{L}+/gu), (m) => m[0])
          .filter((token) => token.length > 2)
      )
      let score = 0
      for (const term of queryTerms) {
        if (contentTerms.has(term)) score += 1
      }
      return { ...chunk, similarity: score }
    })
    .filter((chunk) => chunk.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)

  return scored
}

export async function generateAnswer(
  question: string,
  chunks: RelevantChunk[]
): Promise<string> {
  if (chunks.length === 0) {
    return "I couldn't find any relevant information in this document to answer your question. Try rephrasing or asking about a different topic covered in the PDF."
  }

  const context = chunks
    .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
    .join('\n\n')

  const prompt = `You are a helpful assistant that answers questions strictly based on the provided document excerpts.

DOCUMENT EXCERPTS:
${context}

QUESTION:
${question}

INSTRUCTIONS:
- Answer using only the information in the excerpts above
- If the excerpts don't contain enough information, say so clearly
- Be concise and direct
- Do not make up or infer information not present in the excerpts
- Reference specific parts of the document when relevant

ANSWER:`

  try {
    if (flashModel) {
      const result = await flashModel.generateContent(prompt)
      return result.response.text()
    }
  } catch (err: any) {
    console.error('[rag] generateAnswer model error:', err?.message || err)
    // Fall through to mock response
  }

  // Fallback: mock response based on chunks
  return mockGenerateAnswer(question, chunks)
}

function mockGenerateAnswer(question: string, chunks: RelevantChunk[]): string {
  // Generate a simple mock response summarizing chunk content
  const sourceText = chunks.map(c => c.content).join(' ')
  const hasKeyword = question.toLowerCase().split(/\s+/).some(word => 
    sourceText.toLowerCase().includes(word) && word.length > 3
  )
  
  if (hasKeyword) {
    return `Based on the provided document, I found relevant information related to your question. The document contains: ${chunks.map(c => c.content.substring(0, 100)).join('; ')}...`
  }
  return "The document doesn't appear to contain a direct answer to your question, but here's what's relevant: " + chunks.map(c => c.content.substring(0, 100)).join('; ') + "..."
}

export async function ragQuery(
  question: string,
  documentId: string,
  chatId: string
): Promise<RAGResult> {
  try {
    const sources = await retrieveRelevantChunks(question, documentId)
    const answer = await generateAnswer(question, sources)

    await prisma.message.createMany({
      data: [
        { role: 'user',      content: question, chatId },
        { role: 'assistant', content: answer,   chatId },
      ],
    })

    return { answer, sources }
  } catch (err: any) {
    console.error('[rag] ragQuery error:', err?.message || err)
    throw err
  }
}