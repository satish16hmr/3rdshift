-- Phase 4: derivation_anomalies — log when client supplies a field that differs from server-derived value
-- Service-role-only reads. RLS enabled with zero user-facing policies.

CREATE TABLE IF NOT EXISTS derivation_anomalies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,
  workspace_id UUID,
  route        TEXT        NOT NULL,
  field_name   TEXT        NOT NULL,
  client_value TEXT,
  derived_value TEXT,
  occurred_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE derivation_anomalies ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies — service-role only (supabaseAdmin bypasses RLS)

CREATE INDEX IF NOT EXISTS derivation_anomalies_occurred_at_idx ON derivation_anomalies (occurred_at DESC);
CREATE INDEX IF NOT EXISTS derivation_anomalies_route_idx ON derivation_anomalies (route);
