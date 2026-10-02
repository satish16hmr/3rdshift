'use client';
/**
 * Authenticated fetch helper for Agent Mode API calls.
 * Automatically attaches the Supabase Bearer token.
 * Client-side only — uses browser Supabase session.
 */
import { createClient } from '@/lib/supabase/client';

export async function agentFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
