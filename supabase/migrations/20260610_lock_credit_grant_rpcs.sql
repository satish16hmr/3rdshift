-- Security hardening for SECURITY DEFINER credit / entitlement mutation RPCs.
-- Fable audit commit 52293347 finding #1: add_heavy_credits was executable by
-- client roles, allowing authenticated users to mint heavy credits directly.

-- Critical fix: only backend service_role may grant heavy credits.
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.add_heavy_credits(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_heavy_credits(UUID, INT) TO service_role;

-- Sibling SECURITY DEFINER credit/task entitlement mutators: keep service-only.
-- Some older migrations revoked PUBLIC only; explicitly remove anon/authenticated
-- too so future explicit grants or schema defaults cannot re-open the hole.
REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(UUID, INT, TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INT, TEXT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.increment_light_task_count(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_light_task_count(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.increment_light_task_count(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_light_task_count(UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION public.decrement_light_task_count(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_light_task_count(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.decrement_light_task_count(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_light_task_count(UUID, INT) TO service_role;
