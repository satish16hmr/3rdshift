import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth'

const BUCKET = 'company-logos'
const PREFIX = 'workspace-logos'

async function ensureCompanyLogoBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) throw listError
  if (buckets?.some(bucket => bucket.id === BUCKET)) return

  const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw createError
  }
}

async function removeWorkspaceLogoFiles(workspaceId: string) {
  const { data: files, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(`${PREFIX}/${workspaceId}`, { limit: 100 })

  if (error) {
    if (error.message.toLowerCase().includes('not found')) return
    throw error
  }

  const paths = files
    ?.filter(file => file.name && !file.name.startsWith('.'))
    .map(file => `${PREFIX}/${workspaceId}/${file.name}`) || []

  if (paths.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(paths)
  }
}

async function bestEffortSaveLogoUrl(workspaceId: string, logoUrl: string | null) {
  const { error } = await supabaseAdmin
    .from('workspaces')
    .update({ company_logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)

  if (error && !error.message.toLowerCase().includes('company_logo_url')) {
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = auth

    const blob = await req.blob()
    if (!blob || blob.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (blob.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max file size is 5MB' }, { status: 400 })
    }

    const contentType = req.headers.get('content-type') || blob.type || 'image/jpeg'
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(contentType)) {
      return NextResponse.json({ error: 'Only JPG, PNG, or WebP files are allowed' }, { status: 400 })
    }

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const filePath = `${PREFIX}/${workspaceId}/${Date.now()}.${ext}`

    await ensureCompanyLogoBucket()

    await removeWorkspaceLogoFiles(workspaceId).catch(() => undefined)

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, blob, { upsert: false, contentType })

    if (uploadError) {
      console.error('Company logo storage upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filePath)

    try {
      await bestEffortSaveLogoUrl(workspaceId, publicUrl)
    } catch (updateError) {
      console.error('Workspace logo update error:', updateError)
      return NextResponse.json({ error: 'Could not save company logo' }, { status: 500 })
    }

    return NextResponse.json({ logoUrl: publicUrl })
  } catch (err) {
    console.error('upload-company-logo unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = auth

    await removeWorkspaceLogoFiles(workspaceId).catch(() => undefined)

    try {
      await bestEffortSaveLogoUrl(workspaceId, null)
    } catch (updateError) {
      console.error('Workspace logo remove error:', updateError)
      return NextResponse.json({ error: 'Could not remove company logo' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('delete-company-logo unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
