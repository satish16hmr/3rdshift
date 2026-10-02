import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '@/lib/api-auth'

const BUCKET = 'company-logos'
const PREFIX = 'workspace-logos'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = auth

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('company_logo_url')
      .eq('id', workspaceId)
      .single()

    if (workspaceError && !workspaceError.message.toLowerCase().includes('company_logo_url')) {
      throw workspaceError
    }

    if (workspace?.company_logo_url) {
      return NextResponse.json({ logoUrl: workspace.company_logo_url })
    }

    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(`${PREFIX}/${workspaceId}`, { limit: 100 })

    if (listError) {
      console.error('company-logo storage list error:', listError)
      return NextResponse.json({ logoUrl: null })
    }

    const latest = files
      ?.filter(file => file.name && !file.name.startsWith('.'))
      .sort((a, b) => b.name.localeCompare(a.name))[0]
    if (!latest?.name) return NextResponse.json({ logoUrl: null })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(`${PREFIX}/${workspaceId}/${latest.name}`)

    return NextResponse.json({ logoUrl: publicUrl })
  } catch (err) {
    console.error('company-logo GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
