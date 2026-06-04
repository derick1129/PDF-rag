import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import path from 'path'

// Point pdfjs at the local worker file to avoid bundler fake-worker import issues.
try {
    const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
    // Use file:// URL so dynamic import resolves to the real file system path.
    ;(pdfjs as any).GlobalWorkerOptions.workerSrc = `file://${workerPath}`
} catch (e) {
    // ignore; fallback to default behavior
}
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    const params: any = { data: new Uint8Array(buffer), disableWorker: true, disableFontFace: true }
    const origWarn = console.warn
    const origError = console.error
    console.warn = () => {}
    console.error = () => {}
    const loadingTask = pdfjs.getDocument(params)
    const doc = await loadingTask.promise
    console.warn = origWarn
    console.error = origError

    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        // Try normalized text extraction first
        let content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false } as any)
        let pageText = content.items.map((it: any) => (it.str || '')).join('')

        // If nothing extracted, try a second pass without normalization
        if (!pageText || pageText.trim().length === 0) {
            content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false } as any)
            pageText = content.items.map((it: any) => (it.str || '')).join('')
        }
        text += pageText + '\n\n'
        page.cleanup()
    }

    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()

    if (!text || text.length === 0) {
        throw new Error('No text could be extracted from this PDF. It may be a scanned image — try a text-based PDF instead.')
    }

    return text
}

export async function chunkText(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ['\n\n', '\n', '. ', '! ', '? ', ', ', ' ', ''],
    })
    const chunks = await splitter.splitText(text)

    return chunks 
        .map(c => c.trim())
        .filter(c => c.length > 50)
}

export async function extractAndChunk(buffer: Buffer): Promise<{
    text: string
    chunks: string[]
    pageCount: number
}> {
    const params: any = { data: new Uint8Array(buffer), disableWorker: true, disableFontFace: true }
    const origWarn2 = console.warn
    const origError2 = console.error
    console.warn = () => {}
    console.error = () => {}
    const loadingTask = pdfjs.getDocument(params)
    const doc = await loadingTask.promise
    console.warn = origWarn2
    console.error = origError2

    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((it: any) => (it.str || '')).join('')
        if (!pageText || pageText.trim().length === 0) {
            console.warn(`[pdf] page ${i} has ${content.items.length} text items but produced no string`) 
            // log a sample of items for debugging
            const sample = content.items.slice(0, 5).map((it: any) => ({str: it.str, transform: it.transform}))
            console.warn('[pdf] sample items:', sample)
        }
        text += pageText + '\n\n'
        page.cleanup()
    }

    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()

    if (!text || text.length === 0) {
        throw new Error('No text could be extracted from this PDF. It may be a scanned image — try a text-based PDF instead.')
    }

    const chunks = await chunkText(text)

    return {
        text,
        chunks,
        pageCount: doc.numPages,
    }
}