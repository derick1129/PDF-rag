import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini embedding model only if key and USE_REAL_EMBEDDINGS is enabled
// Otherwise fall back to mock embeddings (3072 dimensions to match gemini-embedding-2)
let model: any = null
if (process.env.USE_REAL_EMBEDDINGS === 'true' && process.env.GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' })
  } catch (err) {
    console.warn('[embed] Failed to initialize Gemini model, falling back to local mock')
  }
}

export async function embedText(text: string): Promise<number[]> {
    if (model) {
        try {
            const result = await model.embedContent(text)
            // Ensure output is always 768-d (schema requirement)
            return normalizeDimension(result.embedding.values)
        } catch (err: any) {
            console.warn('[embed] embedText failed, falling back to mock:', err?.message || err)
            model = null
            return fakeEmbed(text)
        }
    }
    return fakeEmbed(text)
}

export async function embedBatch(
  texts: string[],
  batchSize = 20,
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)

        if (model) {
            try {
                const results = await Promise.all(batch.map((t) => model.embedContent(t)))
                // Normalize all to 768-d
                embeddings.push(...results.map((r: any) => normalizeDimension(r.embedding.values)))
            } catch (err: any) {
                console.warn('[embed] embedBatch remote model failed, falling back to mock:', err?.message || err)
                model = null
                embeddings.push(...batch.map((t) => fakeEmbed(t)))
            }
        } else {
            embeddings.push(...batch.map(t => fakeEmbed(t)))
        }

        onProgress?.(Math.min(i + batchSize, texts.length), texts.length)

       if (i + batchSize < texts.length) {
          await sleep(200)
       }
  }

  return embeddings
}

export function formatVector(values: number[]): string {
    return `[${values.join(',')}]`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Local mock embedding generator ----
// Produces a deterministic 768-dimensional vector (matching schema vector(768))
// Used by default; real API only if USE_REAL_EMBEDDINGS=true is set
function fakeEmbed(text: string): number[] {
    const dim = 768
    const vector = new Array(dim).fill(0)
    const tokens = Array.from(text.toLowerCase().matchAll(/\p{L}+/gu), m => m[0])
    const uniqueTokens = new Set(tokens.filter((w) => w.length > 2))

    for (const token of uniqueTokens) {
        const idx = hashString(token) % dim
        vector[idx] += 1
    }

    return normalizeVector(vector)
}

function normalizeVector(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    if (norm === 0) return vec.map(() => 0)
    return vec.map((v) => v / norm)
}

function hashString(s: string): number {
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619) >>> 0
    }
    return h || 1
}

// Normalize any embedding to 768 dimensions (schema requirement)
// If input is 3072-d (from real Gemini), sample every 4th element.
// We normalize the result so distance comparisons are meaningful.
function normalizeDimension(vec: number[]): number[] {
    const targetDim = 768
    let result: number[]
    if (vec.length === targetDim) {
        result = vec.slice()
    } else if (vec.length === 3072) {
        result = []
        for (let i = 0; i < 3072; i += 4) {
            result.push(vec[i])
        }
    } else {
        result = []
        const step = vec.length / targetDim
        for (let i = 0; i < targetDim; i++) {
            result.push(vec[Math.floor(i * step)])
        }
    }
    return normalizeVector(result)
}
