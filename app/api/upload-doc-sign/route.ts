/**
 * /api/upload-doc-sign
 * Returns presigned upload URLs for document files so browser uploads go
 * directly to Supabase Storage. This avoids Vercel/Next API body limits while
 * keeping server-side auth, size, extension, MIME, and practical magic-byte
 * validation aligned with the legacy DOC_MAX_BYTES path in /api/upload-file.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fileTypeFromBuffer } from 'file-type'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth'

const DOC_MAX_BYTES = 50 * 1024 * 1024

const DOC_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.pdf', '.txt', '.doc', '.docx']
const DOC_MIME_TYPES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]

const TEXT_MIME_TYPES = ['text/csv', 'text/plain']
const ZIP_BASED_DOC_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const OLE_DOC_MIME_TYPES = ['application/vnd.ms-excel', 'application/msword']

function safePathSegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned || fallback
}

function getExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/)
  return match ? match[0] : ''
}

function hasOleHeader(head: Buffer) {
  return (
    head.length >= 8 &&
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0 &&
    head[4] === 0xa1 &&
    head[5] === 0xb1 &&
    head[6] === 0x1a &&
    head[7] === 0xe1
  )
}

function hasZipHeader(head: Buffer) {
  return (
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) &&
    (head[3] === 0x04 || head[3] === 0x06 || head[3] === 0x08)
  )
}

function hasPdfHeader(head: Buffer) {
  return head.length >= 5 && head.subarray(0, 5).toString('ascii') === '%PDF-'
}

function isDeclaredTypeCompatibleWithExtension(ext: string, mimeType: string) {
  if (ext === '.csv') return ['text/csv', 'text/plain', 'application/vnd.ms-excel'].includes(mimeType)
  if (ext === '.txt') return mimeType === 'text/plain'
  if (ext === '.pdf') return mimeType === 'application/pdf'
  if (ext === '.xls') return ['application/vnd.ms-excel', 'application/msword'].includes(mimeType)
  if (ext === '.xlsx') return mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.doc') return ['application/msword', 'application/vnd.ms-excel'].includes(mimeType)
  if (ext === '.docx') return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return false
}

async function validateDocumentMagicBytes(ext: string, mimeType: string, magicBytes: string) {
  if (typeof magicBytes !== 'string' || magicBytes.length === 0) {
    return 'Could not verify file type. Please try again.'
  }

  const head = Buffer.from(magicBytes, 'base64')

  if (TEXT_MIME_TYPES.includes(mimeType)) {
    return null
  }

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    return hasPdfHeader(head) ? null : 'File type mismatch — content does not match declared type.'
  }

  if (ZIP_BASED_DOC_MIME_TYPES.includes(mimeType) || ext === '.docx' || ext === '.xlsx') {
    return hasZipHeader(head) ? null : 'File type mismatch — content does not match declared type.'
  }

  if (OLE_DOC_MIME_TYPES.includes(mimeType) || ext === '.doc' || ext === '.xls') {
    return hasOleHeader(head) ? null : 'File type mismatch — content does not match declared type.'
  }

  const detected = await fileTypeFromBuffer(head)
  if (!detected) {
    return 'Could not detect file type. File may be corrupted or unsupported.'
  }
  if (!DOC_MIME_TYPES.includes(detected.mime)) {
    return `File type not allowed: ${detected.mime}`
  }
  if (detected.mime !== mimeType) {
    return 'File type mismatch — content does not match declared type.'
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
    const ext = getExtension(name)
    if (!DOC_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV, XLS, XLSX, PDF, TXT, DOC, or DOCX.' }, { status: 400 })
    }

    const size = Number(fileSize)
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Missing file size.' }, { status: 400 })
    }
    if (size > DOC_MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Max 50MB.' }, { status: 413 })
    }

    const declaredMime = String(mimeType || '')
    if (!DOC_MIME_TYPES.includes(declaredMime) || !isDeclaredTypeCompatibleWithExtension(ext, declaredMime)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload CSV, XLS, XLSX, PDF, TXT, DOC, or DOCX.' }, { status: 400 })
    }

    const magicError = await validateDocumentMagicBytes(ext, declaredMime, String(magicBytes || ''))
    if (magicError) {
      return NextResponse.json({ error: magicError }, { status: 400 })
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
    const folderName = safePathSegment(String(fieldName || 'documents'), 'documents')
    const path = `${folderName}/${Date.now()}-${safeName}`

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUploadUrl(path, { upsert: false })

    if (error || !data) {
      console.error('[upload-doc-sign] presign error', {
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
      console.error('[upload-doc-sign] signed URL error', {
        message: error?.message,
        statusCode: error && 'statusCode' in error ? error.statusCode : undefined,
      })
      return NextResponse.json({ error: 'Could not generate document URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
