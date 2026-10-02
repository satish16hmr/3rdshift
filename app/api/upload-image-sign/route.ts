/**
 * /api/upload-image-sign
 * Returns presigned upload URLs for image files so browser uploads go directly
 * to Supabase Storage. This avoids Vercel/Next API body limits while keeping
 * server-side auth, size, extension, and magic-byte validation.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth'

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024

function safePathSegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned || fallback
}

function detectImageMime(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const { action, fileName, fieldName, storagePath, fileSize, mimeType, magicBytes } = body

  if (action === 'sign-upload') {
    const name = String(fileName || '')
    const lowerName = name.toLowerCase()
    const hasValidExt = ACCEPTED_EXTENSIONS.some(ext => lowerName.endsWith(ext))
    if (!hasValidExt) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload JPEG, PNG, or WebP.' }, { status: 400 })
    }

    const size = Number(fileSize)
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Missing file size.' }, { status: 400 })
    }
    if (size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 413 })
    }

    const declaredMime = String(mimeType || '')
    if (!ACCEPTED_MIME_TYPES.includes(declaredMime)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload JPEG, PNG, or WebP.' }, { status: 400 })
    }

    if (typeof magicBytes !== 'string' || magicBytes.length === 0) {
      return NextResponse.json({ error: 'Could not verify file type. Please try again.' }, { status: 400 })
    }

    const detectedMime = detectImageMime(Buffer.from(magicBytes, 'base64'))
    if (!detectedMime) {
      return NextResponse.json({ error: 'Could not detect file type. File may be corrupted or unsupported.' }, { status: 400 })
    }
    if (!ACCEPTED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: `File type not allowed: ${detectedMime}` }, { status: 400 })
    }
    if (detectedMime !== declaredMime && !(declaredMime === 'image/jpg' && detectedMime === 'image/jpeg')) {
      return NextResponse.json({ error: 'File type mismatch — content does not match declared type.' }, { status: 400 })
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
    const folderName = safePathSegment(String(fieldName || 'face-photos'), 'face-photos')
    const path = `${folderName}/${Date.now()}-${safeName}`

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUploadUrl(path, { upsert: false })

    if (error || !data) {
      console.error('[upload-image-sign] presign error', {
        message: error?.message,
        statusCode: error && 'statusCode' in error ? error.statusCode : undefined,
        folderName,
      })
      return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 500 })
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '')
    const uploadUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${supabaseUrl}/storage/v1${data.signedUrl}`

    return NextResponse.json({ uploadUrl, storagePath: path, token: data.token })
  }

  if (action === 'sign-download') {
    const path = String(storagePath || '')
    if (!path) return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 })

    const folderName = safePathSegment(String(fieldName || ''), '')
    if (folderName && !path.startsWith(`${folderName}/`)) {
      return NextResponse.json({ error: 'Unauthorized: path does not match upload field' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUrl(path, 31536000 * 10)

    if (error || !data?.signedUrl) {
      console.error('[upload-image-sign] signed URL error', {
        message: error?.message,
        statusCode: error && 'statusCode' in error ? error.statusCode : undefined,
      })
      return NextResponse.json({ error: 'Could not generate image URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
