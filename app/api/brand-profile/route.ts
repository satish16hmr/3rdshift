import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { callAI } from '@/lib/ai/callAI';
import { buildBrandProfileUpsertPayload, type BrandProfileBody } from '@/lib/brand-profile';

// GET /api/brand-profile
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data, error } = await supabaseAdmin
    .from('brand_profile')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  return NextResponse.json({ brand_profile: data ?? null });
}

// PUT /api/brand-profile
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let body: BrandProfileBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('brand_profile')
    .upsert(buildBrandProfileUpsertPayload({ userId, workspaceId, body }), { onConflict: 'workspace_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });

  // Also sync brand memories for cross-member context
  const brandFields: Record<string, string | undefined> = {
    company_name: body.company_name,
    industry: body.industry,
    audience: body.audience,
    tone: body.tone,
  };

  for (const [field, value] of Object.entries(brandFields)) {
    if (!value?.trim()) continue;

    const memContent = `${field.replace('_', ' ')}: ${value.trim()}`;

    // Check if this exact memory already exists
    const { data: existing } = await supabaseAdmin
      .from('team_member_memories')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('memory_type', 'brand')
      .is('member_id', null)
      .ilike('content', `${field.replace('_', ' ')}:%`)
      .is('invalidated_at', null)
      .limit(1);

    if (existing && existing.length > 0) {
      // Invalidate old, insert new
      await supabaseAdmin
        .from('team_member_memories')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', existing[0].id);
    }

    await supabaseAdmin.from('team_member_memories').insert({
      user_id: userId,
      workspace_id: workspaceId,
      member_id: null,
      memory_type: 'brand',
      content: memContent,
    });
  }

  // Compress brand profile with Haiku for token-efficient chat injection (~200 tokens vs ~500)
  try {
    const profileFields = [
      body.company_name && `Company: ${body.company_name}`,
      body.industry && `Industry: ${body.industry}`,
      body.audience && `Audience: ${body.audience}`,
      body.tone && `Voice: ${body.tone}`,
      body.competitors && `Competitors: ${body.competitors}`,
      body.additional_context && `Notes: ${body.additional_context}`,
    ].filter(Boolean).join('\n');

    if (profileFields.trim()) {
      const haikusRes = await callAI({
        model_tier: 'haiku',
        system: 'You compress brand profiles into concise AI assistant context. Return only the compressed text, no preamble.',
        messages: [{
          role: 'user',
          content: `Summarize this brand profile into a concise context block for an AI writing assistant. Target: 200 tokens or less. Preserve: brand name, product/service (one sentence), target audience (one line), brand voice (3-5 words), any non-negotiable rules. Format as plain text instructions an AI would follow when creating content for this brand. No headers, no JSON.\n\nBrand profile:\n${profileFields}`,
        }],
        max_tokens: 250,
      }, { call_type: 'brand-compress' });

      await supabaseAdmin.from('brand_profile').update({
        compressed_profile: haikusRes.content.trim(),
        compressed_at: new Date().toISOString(),
      }).eq('workspace_id', workspaceId);
    }
  } catch {
    // Non-fatal — raw profile still works as fallback
  }

  return NextResponse.json({ brand_profile: data });
}
