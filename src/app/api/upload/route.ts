import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractAndChunk } from "@/lib/pdf";
import { embedBatch, formatVector } from "@/lib/embeddings";
import { randomUUID } from "crypto";

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPE = "application/pdf";

export async function POST(req: NextRequest) {
  let document: { id: string } | null = null;

  try {
    // 1. Parse the uploaded file and validate it's a PDF. Some clients
    // (curl, etc.) may not set `file.type`, so additionally check the
    // PDF magic header (`%PDF`) from the first bytes.
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Pull bytes early so we can do robust validation even when `file.type` is empty
    const bytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(bytes);
    // Robust PDF magic header check: look for '%PDF' in the first few bytes.
    const looksLikePdf = uint8.length >= 4 &&
      uint8[0] === 0x25 && // '%'
      uint8[1] === 0x50 && // 'P'
      uint8[2] === 0x44 && // 'D'
      uint8[3] === 0x46    // 'F'
    const detectedType = file.type || (looksLikePdf ? ALLOWED_TYPE : '');

    if (detectedType !== ALLOWED_TYPE) {
      return NextResponse.json(
        { error: "Only PDF files are accepted." },
        { status: 415 },
      );
    }

    if (uint8.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 413 },
      );
    }

    // 2. Convert to Buffer and extract text + chunks
    const buffer = Buffer.from(uint8);

    const { chunks, pageCount } = await extractAndChunk(buffer);

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No usable text found in this PDF. Make sure it is not a scanned image.",
        },
        { status: 422 },
      );
    }

    // 3. Create the Document row right away 
    // Doing this before embedding means we can clean up on error.
    document = await prisma.document.create({
      data: { filename: file.name },
    });

    // 4. Embed all chunks in batches of 20 
    const vectors = await embedBatch(chunks, 20, (done, total) => {
      console.log(
        `[upload] embedding ${done}/${total} chunks for doc ${document!.id}`,
      );
    });

    // 5. Insert Chunk rows with pgvector embeddings 
    // Prisma cannot write to Unsupported("vector(768)") columns,
    // so we use $executeRawUnsafe with a cast for each row.
    await Promise.all(
      chunks.map((content, i) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "Chunk" (id, content, embedding, "documentId")
           VALUES ($1, $2, $3::vector, $4)`,
          randomUUID(),
          content,
          formatVector(vectors[i]),
          document!.id,
        ),
      ),
    );

    // 6. Create a Chat session linked to this document
    const chat = await prisma.chat.create({
      data: { documentId: document?.id },
    });

    console.log(
      `[upload] done — doc ${document?.id}, ${chunks.length} chunks, ${pageCount} pages, chat ${chat.id}`,
    );

    return NextResponse.json({
      documentId: document?.id,
      chatId: chat.id,
      chunkCount: chunks.length,
      pageCount,
    });
  } catch (err: unknown) {
    console.error("[upload] error:", err);

    // Clean up the Document row (and its Chunks via cascade) if something
    // went wrong after we created it, so the DB stays consistent.
    if (document?.id) {
      await prisma.document
        .delete({ where: { id: document.id } })
        .catch(() => {});
    }

    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
