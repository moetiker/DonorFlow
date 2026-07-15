import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withApiRoute } from '@/lib/api-helpers'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = 'application/pdf'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Upload (or replace) the donor letter PDF for a fiscal year.
 * POST multipart/form-data with a `file` field.
 */
export const POST = withApiRoute(async (request: NextRequest, { params }: RouteContext) => {
  const { id: fiscalYearId } = await params

  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } })
  if (!fiscalYear) {
    return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.type !== ALLOWED_MIME) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large (max 5 MB)' }, { status: 400 })
  }

  const data = Buffer.from(await file.arrayBuffer())
  const fileName = file.name || 'goennerbrief.pdf'

  const letter = await prisma.donorLetter.upsert({
    where: { fiscalYearId },
    create: { fiscalYearId, fileName, mimeType: file.type, size: file.size, data },
    update: { fileName, mimeType: file.type, size: file.size, data },
    select: { fileName: true, size: true, uploadedAt: true }
  })

  return NextResponse.json(letter, { status: 201 })
})

/**
 * Stream the stored donor letter PDF for viewing/downloading.
 */
export const GET = withApiRoute(async (_request: NextRequest, { params }: RouteContext) => {
  const { id: fiscalYearId } = await params

  const letter = await prisma.donorLetter.findUnique({ where: { fiscalYearId } })
  if (!letter) {
    return NextResponse.json({ error: 'No donor letter for this fiscal year' }, { status: 404 })
  }

  const body = new Uint8Array(letter.data)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': letter.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(letter.fileName)}"`,
      'Content-Length': String(letter.size),
      'Cache-Control': 'private, no-cache'
    }
  })
})

/**
 * Remove the donor letter for a fiscal year.
 */
export const DELETE = withApiRoute(async (_request: NextRequest, { params }: RouteContext) => {
  const { id: fiscalYearId } = await params

  await prisma.donorLetter.deleteMany({ where: { fiscalYearId } })
  return NextResponse.json({ success: true })
})
