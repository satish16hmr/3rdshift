import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

function createAdminClient() {
  return supabaseAdmin;
}

// GET /api/agent-mode/presets — list all active presets (public, no auth required)
export async function GET() {
  const supabase = createAdminClient();

  const { data: presets, error } = await supabase
    .from('agent_mode_presets')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('sort_order');

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({ presets: presets ?? [] });
}
