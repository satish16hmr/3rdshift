import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/api-auth';

/**
 * POST /api/profile/update
 *
 * Updates profile fields for the authenticated user.
 * Enforces a strict 3-field whitelist. team_updates_settings JSONB is
 * fully validated (key whitelist, type checks, size cap).
 *
 * Per v8 R4 spec (audit-rls-fix-design-v6.md Section R4).
 *
 * Request body: one or more of:
 *   full_name              string | null  (max 100 chars)
 *   brand_context          string | null  (max 5000 chars)
 *   team_updates_settings  object         (validated JSONB)
 *
 * Auth: JWT only. WHERE id = userId — user can only update own profile.
 */

const ALLOWED_PROFILE_FIELDS = ['full_name', 'brand_context', 'team_updates_settings'] as const;
type AllowedProfileField = typeof ALLOWED_PROFILE_FIELDS[number];

const VALID_FREQUENCIES = ['once_weekly', 'few_times_weekly', 'off'] as const;

const VALID_WORKER_SLUGS = [
  'hook-specialist',
  'email-copywriter',
  'ad-copywriter',
  'seo-strategist',
  'social-media-creator',
  'lead-generator',
] as const;

const VALID_TUS_KEYS = ['enabled', 'frequency', 'worker_overrides'] as const;

export async function POST(req: NextRequest) {
  // 1. JWT auth (inline — same pattern as R1/R2/R3)
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  // 2. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
  }

  // 3. Whitelist — reject unknown keys
  for (const key of Object.keys(body)) {
    if (!(ALLOWED_PROFILE_FIELDS as readonly string[]).includes(key)) {
      return NextResponse.json({ error: `Field not allowed: ${key}` }, { status: 400 });
    }
  }

  // 4. Per-field type validation

  // full_name — string | null, max 100 chars
  if ('full_name' in body) {
    const v = body.full_name;
    if (v !== null && typeof v !== 'string') {
      return NextResponse.json({ error: 'full_name must be a string or null' }, { status: 400 });
    }
    if (typeof v === 'string' && v.length > 100) {
      return NextResponse.json({ error: 'full_name must be 100 characters or fewer' }, { status: 400 });
    }
  }

  // brand_context — string | null, max 5000 chars
  if ('brand_context' in body) {
    const v = body.brand_context;
    if (v !== null && typeof v !== 'string') {
      return NextResponse.json({ error: 'brand_context must be a string or null' }, { status: 400 });
    }
    if (typeof v === 'string' && v.length > 5000) {
      return NextResponse.json({ error: 'brand_context must be 5000 characters or fewer' }, { status: 400 });
    }
  }

  // team_updates_settings — validated JSONB (F22)
  if ('team_updates_settings' in body) {
    const v = body.team_updates_settings;

    if (typeof v !== 'object' || Array.isArray(v) || v === null) {
      return NextResponse.json({ error: 'team_updates_settings must be an object' }, { status: 400 });
    }

    // Size cap — max valid payload ~185 bytes; 4096 is generous ceiling
    if (JSON.stringify(v).length > 4096) {
      return NextResponse.json({ error: 'team_updates_settings payload too large' }, { status: 413 });
    }

    const tus = v as Record<string, unknown>;

    // Required keys
    for (const required of VALID_TUS_KEYS) {
      if (!(required in tus)) {
        return NextResponse.json(
          { error: `team_updates_settings missing required key: ${required}` },
          { status: 400 }
        );
      }
    }

    // No unknown keys
    for (const key of Object.keys(tus)) {
      if (!(VALID_TUS_KEYS as readonly string[]).includes(key)) {
        return NextResponse.json(
          { error: `Unknown key in team_updates_settings: ${key}` },
          { status: 400 }
        );
      }
    }

    // enabled — boolean
    if (typeof tus.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'team_updates_settings.enabled must be boolean' },
        { status: 400 }
      );
    }

    // frequency — restricted enum
    if (!(VALID_FREQUENCIES as readonly unknown[]).includes(tus.frequency)) {
      return NextResponse.json(
        { error: `team_updates_settings.frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    // worker_overrides — plain object, known slugs, boolean values
    const wo = tus.worker_overrides;
    if (typeof wo !== 'object' || Array.isArray(wo) || wo === null) {
      return NextResponse.json(
        { error: 'team_updates_settings.worker_overrides must be an object' },
        { status: 400 }
      );
    }
    for (const [slug, val] of Object.entries(wo as Record<string, unknown>)) {
      if (!(VALID_WORKER_SLUGS as readonly string[]).includes(slug)) {
        return NextResponse.json(
          { error: `Unknown worker slug in worker_overrides: ${slug}` },
          { status: 400 }
        );
      }
      if (typeof val !== 'boolean') {
        return NextResponse.json(
          { error: `worker_overrides.${slug} must be boolean` },
          { status: 400 }
        );
      }
    }
  }

  // 5. Build safe update payload (only allowed fields)
  const updatePayload = Object.fromEntries(
    Object.entries(body).filter(([k]) => (ALLOWED_PROFILE_FIELDS as readonly string[]).includes(k))
  ) as Partial<Record<AllowedProfileField, unknown>>;

  // 6. UPDATE via service role — WHERE id = userId (user can only update own profile)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) {
    console.error('[profile/update] update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
