import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api-auth';

const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Service role client — bypasses RLS, safe because we verify the JWT first
export async function POST(req: NextRequest) {
  try {
    // Verify the user's JWT
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = auth.slice(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the image blob from the request body
    const blob = await req.blob()
    if (!blob || blob.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (blob.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max file size is 5MB' }, { status: 400 })
    }

    const bytes = await blob.arrayBuffer()
    const { fileTypeFromBuffer } = await import('file-type')
    const detected = await fileTypeFromBuffer(new Uint8Array(bytes))
    if (!detected || !AVATAR_MIME_TO_EXTENSION[detected.mime]) {
      return NextResponse.json(
        { error: 'Unsupported avatar file type. Please upload JPG, PNG, or WebP.' },
        { status: 400 }
      )
    }

    // Unique filename per upload so CDN never serves stale content
    const timestamp = Date.now()
    const contentType = detected.mime
    const filePath = `${user.id}/${timestamp}.${AVATAR_MIME_TO_EXTENSION[contentType]}`

    // Delete old file if one exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
    if (existingProfile?.avatar_url) {
      try {
        // Extract storage path from public URL: everything after /profile-photos/
        const match = existingProfile.avatar_url.match(/profile-photos\/([^?]+)/)
        if (match?.[1]) {
          await supabaseAdmin.storage.from('profile-photos').remove([decodeURIComponent(match[1])])
        }
      } catch { /* ignore delete errors — old file cleanup is best-effort */ }
    }

    // Upload using service role — no RLS issues
    const { error: uploadError } = await supabaseAdmin.storage
      .from('profile-photos')
      .upload(filePath, bytes, { upsert: false, contentType })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('profile-photos')
      .getPublicUrl(filePath)

    // Save clean URL (no query param needed — unique filename guarantees fresh CDN fetch)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ avatarUrl: publicUrl })
  } catch (err) {
    console.error('upload-avatar unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = auth.slice(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profileForDelete } = await supabaseAdmin
      .from('profiles').select('avatar_url').eq('id', user.id).single()
    if (profileForDelete?.avatar_url) {
      const match = profileForDelete.avatar_url.match(/profile-photos\/([^?]+)/)
      if (match?.[1]) {
        await supabaseAdmin.storage.from('profile-photos').remove([decodeURIComponent(match[1])])
      }
    }

    await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('delete-avatar unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
