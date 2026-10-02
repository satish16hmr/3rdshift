/**
 * Phase 4 — derivation_anomalies logger
 *
 * Logs rejection events when a client sends fields the server derives.
 * With Zod .strict(), the 400 IS the anomaly — we log it so we can see:
 *   - which routes are still receiving extra/derived fields
 *   - which users/workspaces are sending them (stale UI or probing)
 *   - which specific fields were rejected
 *
 * Non-fatal — failures are swallowed so logging never breaks the route.
 */
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function logDerivationRejection({
  userId,
  workspaceId,
  route,
  rejectedFields,
}: {
  userId:         string | null;
  workspaceId:    string | null;
  route:          string;
  rejectedFields: string[];   // field names Zod rejected as unknown/extra
}): Promise<void> {
  if (rejectedFields.length === 0) return;
  try {
    const admin = getAdmin();
    await admin.from('derivation_anomalies').insert(
      rejectedFields.map(field => ({
        user_id:      userId,
        workspace_id: workspaceId,
        route,
        field_name:   field,
        client_value: '(rejected — strict schema)',
        derived_value: '(server-derived)',
      }))
    );
  } catch {
    // Non-fatal — never let logging break the route
  }
}

/**
 * Extract rejected field names from a Zod flatten() error output.
 * In Zod v4, unknown key rejections appear in formErrors as:
 *   'Unrecognized key: "fieldName"'
 * Invalid field errors appear in fieldErrors.
 */
export function extractRejectedFields(zodError: {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}): string[] {
  const fromFieldErrors = Object.keys(zodError.fieldErrors);
  // Parse "Unrecognized key: \"fieldName\"" from formErrors (Zod v4 .strict() format)
  const fromFormErrors = zodError.formErrors
    .map(msg => {
      const match = msg.match(/Unrecognized key: "([^"]+)"/);
      return match ? match[1] : null;
    })
    .filter((k): k is string => k !== null);
  return [...new Set([...fromFieldErrors, ...fromFormErrors])];
}
