import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

function createAdminClient() {
  return supabaseAdmin;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: preset, error } = await supabase
    .from('agent_mode_presets')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 });

  return NextResponse.json({ preset });
}
