'use client';
/**
 * apiFetch — authenticated fetch wrapper with owner-role 403 toast
 *
 * Drop-in replacement for bare `fetch` on client-side calls to owner-only routes.
 * When the server returns 403 with an error containing "requires", dispatches a
 * custom DOM event (`role-denied`) that RoleDeniedToast listens for and renders.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/api-fetch';
 *   const res = await apiFetch('/api/customer-portal', { method: 'POST', ... });
 *
 * Note: Does NOT replace agentFetch (which handles auth token injection for
 * agent-mode routes). Use apiFetch for billing/settings/integration calls that
 * already include their own Authorization header.
 */

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);

  if (res.status === 403) {
    try {
      const body = await res.clone().json();
      // Only fire toast for role-gate 403s (not plan-gate or other 403s)
      if (body?.error && typeof body.error === 'string' && body.error.includes('requires')) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('role-denied', {
            detail: { message: 'This action requires owner access. Contact your workspace owner.' }
          }));
        }
      }
    } catch {
      // Non-JSON 403 — ignore, just return the response
    }
  }

  return res;
}
