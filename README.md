# AI PDF Chatbot

A Next.js app for uploading PDFs, extracting text, generating vector embeddings, and chatting with documents using retrieval-augmented generation (RAG).

## What it does

- Upload a PDF on `/upload`
- Parse text content and split it into searchable chunks
- Generate vector embeddings for each chunk
- Store documents, chunks, and chat sessions in PostgreSQL with `pgvector`
- Start a chat session to ask questions about the uploaded PDF

## Features

- PDF upload and validation
- Text extraction via `pdf-parse`
- Embedding storage in `vector(768)` columns
- Document search by semantic similarity
- Chat UI for PDF-based question answering
- Optional Gemini integration for real embeddings and responses

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Prisma + PostgreSQL
- `pgvector` embeddings
- `pdf-parse` for PDF text extraction
- `@google/generative-ai` for Gemini support
- Tailwind CSS + app router

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with at least:

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
GEMINI_API_KEY=your_gemini_api_key
USE_REAL_EMBEDDINGS=true
```

> If you do not set `USE_REAL_EMBEDDINGS=true`, the app uses a deterministic mock embedding fallback so development still works.

3. Initialize your database:

```bash
npx prisma db push
```

4. Run the dev server:

```bash
npm run dev
```

5. Open [http://localhost:3000].

## App routes

- `/` — Home page with uploaded documents
- `/upload` — Upload a new PDF
- `/chat/[chatId]` — Chat interface for a document session

## Important environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `GEMINI_API_KEY` — Google Gemini API key for real embeddings and response generation
- `USE_REAL_EMBEDDINGS` — `true` to enable Gemini embeddings, otherwise mock vectors are used

## Database models

The Prisma schema defines:

- `Document` — stores uploaded PDF metadata
- `Chunk` — stores text chunks and vector embeddings
- `Chat` — stores chat sessions linked to documents
- `Message` — stores user / assistant messages

## Notes

- The upload form now uses client-side submission and redirects back to `/` after successful upload.
- If Gemini is unavailable or not configured, the app falls back to local mock embeddings and simple answer generation.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```
