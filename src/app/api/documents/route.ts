import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { uploadedAt: 'desc' },
    select: {
      id:         true,
      filename:   true,
      uploadedAt: true,
      chats:      { select: { id: true }, take: 1 },
    },
  })
  return NextResponse.json({ documents })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

  await prisma.document.delete({ where: { id } })
  return NextResponse.json({ success: true })
}