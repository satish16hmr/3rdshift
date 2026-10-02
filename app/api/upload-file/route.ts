import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth')

function getSupabase() {
  return supabaseAdmin;
}

// Max sizes
const VIDEO_MAX_BYTES = 500 * 1024 * 1024 // 500MB
const DOC_MAX_BYTES = 50 * 1024 * 1024    // 50MB

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
]

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

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const fieldName = (formData.get('fieldName') as string | null) || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!type || !['video', 'document', 'image'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const mimeType = file.type
    // Images are small — treat same size limit as documents
    const maxBytes = type === 'video' ? VIDEO_MAX_BYTES : DOC_MAX_BYTES
    const allowedTypes = type === 'video' ? VIDEO_MIME_TYPES : DOC_MIME_TYPES

    // Validate file size
    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max ${type === 'video' ? '500MB' : '50MB'}.` },
        { status: 413 }
      )
    }

    // Validate MIME type — magic-byte sniffing via file-type (not just client-provided content-type)
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(Buffer.from(bytes));

    const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const allAllowedTypes = type === 'image'
      ? IMAGE_MIME_TYPES
      : [...allowedTypes, ...IMAGE_MIME_TYPES];

    // For plain text / CSV — file-type returns undefined (no magic bytes), trust MIME only
    const TEXT_MIME_TYPES = ['text/csv', 'text/plain'];
    const isTextFile = TEXT_MIME_TYPES.includes(mimeType);

    if (!isTextFile) {
      // Must have detectable magic bytes
      if (!detected) {
        return NextResponse.json({ error: 'Could not detect file type. File may be corrupted or unsupported.' }, { status: 400 });
      }
      // Detected MIME must be in allowed list
      if (!allAllowedTypes.includes(detected.mime)) {
        return NextResponse.json({ error: `File type not allowed: ${detected.mime}` }, { status: 400 });
      }
      // Detected MIME must match client-claimed MIME (prevents MIME spoofing)
      if (detected.mime !== mimeType && !(mimeType === 'image/jpg' && detected.mime === 'image/jpeg')) {
        return NextResponse.json({ error: 'File type mismatch — content does not match declared type.' }, { status: 400 });
      }
    } else {
      // Text files — just confirm client-claimed type is in allowed list
      if (!allAllowedTypes.includes(mimeType)) {
        return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
      }
    }

    // Route image type through the document handler (which already handles images)
    if (type === 'image') {
      return await handleDocument(file, bytes, fieldName)
    }

    if (type === 'video') {
      return await handleVideoAudio(file, bytes)
    } else {
      return await handleDocument(file, bytes, fieldName)
    }
  } catch (err: unknown) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}

async function handleVideoAudio(file: File, bytes: ArrayBuffer): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // C2 fix: fail closed — returning a placeholder pretends success and causes silent failures
    return NextResponse.json(
      { error: 'service_unavailable', message: 'Audio/video transcription is temporarily unavailable. Please try again later or use a text transcript.' },
      { status: 503 }
    )
  }

  // Whisper API
  const whisperForm = new FormData()
  whisperForm.append('file', new Blob([bytes], { type: file.type }), file.name)
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('response_format', 'verbose_json')
  whisperForm.append('timestamp_granularities[]', 'segment')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  })

  if (!whisperRes.ok) {
    const errData = await whisperRes.json().catch(() => ({}))
    throw new Error(errData?.error?.message || `Whisper API error: ${whisperRes.status}`)
  }

  const whisperData = await whisperRes.json()

  // Format transcript with timestamps
  let transcript = ''
  if (whisperData.segments && whisperData.segments.length > 0) {
    transcript = whisperData.segments
      .map((seg: { start: number; text: string }) => {
        const minutes = Math.floor(seg.start / 60)
        const seconds = Math.floor(seg.start % 60)
        const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`
        return `[${timestamp}] ${seg.text.trim()}`
      })
      .join('\n')
  } else {
    transcript = whisperData.text || ''
  }

  const transcriptContent = `## Video/Audio Transcript\nFile: ${file.name}\nDuration: ${whisperData.duration ? `${Math.round(whisperData.duration)}s` : 'unknown'}\n\n${transcript}`;

  // Store raw video for FFmpeg workers (research-assistant, data-analyst)
  // TODO: Create 'video-uploads' bucket in Supabase dashboard (Storage > New bucket > private)
  let storagePath: string | null = null;
  try {
    const supabase = getSupabase();
    const videoFileName = `raw-videos/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
    const { data: uploadData, error: upErr } = await supabase.storage
      .from('video-uploads')
      .upload(videoFileName, new Blob([bytes], { type: file.type }), {
        contentType: file.type,
        upsert: false,
      });
    if (!upErr && uploadData) {
      storagePath = videoFileName;
    }
  } catch {
    // Bucket may not exist yet -- continue without storing
  }

  const contentWithPath = storagePath
    ? `[VIDEO_STORAGE_PATH:${storagePath}]\n${transcriptContent}`
    : transcriptContent;

  return NextResponse.json({
    content: contentWithPath,
    storagePath,
    fileName: file.name,
    type: 'video',
    duration: whisperData.duration,
  })
}

async function handleDocument(file: File, bytes: ArrayBuffer, fieldName = ''): Promise<NextResponse> {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type
  let content = ''

  // Image files (JPG, PNG, WebP) — upload to Supabase storage for face cutout processing
  if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    fileName.match(/\.(jpg|jpeg|png|webp)$/i)
  ) {
    try {
      const supabase = getSupabase();
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
      const folderName = fieldName ? fieldName.replace(/[^a-z0-9_-]/gi, '_') : 'face-photos';
      const storagePath = `${folderName}/${Date.now()}-${safeName}`;
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('uploads')
        .upload(storagePath, new Blob([bytes], { type: mimeType }), {
          contentType: mimeType,
          upsert: false,
        });
      if (!upErr && uploadData) {
        let publicUrl = '';
        try {
          const { data: signedData } = await supabase.storage
            .from('uploads')
            .createSignedUrl(storagePath, 31536000 * 10); // 10 years
          if (signedData?.signedUrl) {
            publicUrl = signedData.signedUrl;
          }
        } catch (err) {
          console.error('Error creating signed URL:', err);
        }
        if (!publicUrl) {
          publicUrl = supabase.storage.from('uploads').getPublicUrl(storagePath).data.publicUrl;
        }

        return NextResponse.json({
          content: `[STORAGE_PATH: ${storagePath}]${fieldName ? ` [FIELD: ${fieldName}]` : ''}`,
          storagePath,
          publicUrl,
          fileName: file.name,
          type: 'image',
        });
      }
    } catch {
      // Fall through to generic handler
    }
    // Fallback: return a note without storage
    return NextResponse.json({
      content: `[Image uploaded: ${file.name} (${(bytes.byteLength / 1024).toFixed(1)}KB). Storage unavailable — face cutout may not work.]`,
      fileName: file.name,
      type: 'image',
    });
  }

  // CSV / plain text — decode directly
  if (
    mimeType === 'text/csv' ||
    mimeType === 'text/plain' ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.txt')
  ) {
    const text = new TextDecoder('utf-8').decode(bytes)
    const lines = text.split('\n').filter(l => l.trim())

    if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
      // Format CSV as readable table summary
      const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rowCount = lines.length - 1
      const sampleRows = lines.slice(1, Math.min(6, lines.length))

      content = `## CSV File: ${file.name}\nRows: ${rowCount} | Columns: ${headers?.length || 0}\n\nColumns: ${headers?.join(', ')}\n\nFirst ${sampleRows.length} rows:\n${sampleRows.join('\n')}\n\n[Full dataset: ${rowCount} rows provided]`

      // If file is small enough, include all rows
      if (rowCount <= 200) {
        content = `## CSV File: ${file.name}\nRows: ${rowCount} | Columns: ${headers?.length || 0}\n\nColumns: ${headers?.join(', ')}\n\n${lines.slice(1).join('\n')}`
      }
    } else {
      content = `## Text File: ${file.name}\n\n${text.slice(0, 50000)}`
    }
  }
  // Excel (XLS/XLSX) — basic extraction without a library
  else if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.xlsx')
  ) {
    // Without xlsx library, provide a helpful message with file details
    const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(2)
    content = `## Excel File: ${file.name} (${sizeMB}MB)\n\nNote: Excel file uploaded. To analyze the data, please also paste the key data as text in the task description field, or export as CSV for best results.\n\nFile received and ready for processing.`
  }
  // PDF — proper text extraction via unpdf (Next.js compatible)
  else if (
    mimeType === 'application/pdf' ||
    fileName.endsWith('.pdf')
  ) {
    try {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(new Uint8Array(bytes), { mergePages: true })
      const extracted = (text || '').trim()
      if (extracted.length > 100) {
        content = `## PDF Document: ${file.name}\n\n${extracted.slice(0, 50000)}`
      } else {
        content = `## PDF Document: ${file.name}\n\nThis PDF appears to be a scanned image — no readable text could be extracted. Please paste your resume text directly into the "Paste LinkedIn / Bio" field instead.`
      }
    } catch (e) {
      content = `## PDF Document: ${file.name}\n\nCould not extract text from this PDF. Please paste your resume text directly into the form instead.`
    }
  }
  // Word documents — proper extraction via mammoth
  else if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.doc') ||
    fileName.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
      const extracted = result.value?.trim() || ''
      if (extracted.length > 100) {
        content = `## Word Document: ${file.name}\n\n${extracted.slice(0, 50000)}`
      } else {
        content = `## Word Document: ${file.name}\n\nDocument appears empty or unreadable. Please paste your resume text directly into the form instead.`
      }
    } catch (e) {
      content = `## Word Document: ${file.name}\n\nCould not extract text from this document. Please paste your resume text directly into the form instead.`
    }
  } else {
    content = `## File: ${file.name}\n\nFile uploaded (${(bytes.byteLength / 1024).toFixed(1)}KB). Processing complete.`
  }

  return NextResponse.json({
    content,
    fileName: file.name,
    type: 'document',
  })
}
