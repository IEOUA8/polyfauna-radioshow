-- POLYFAUNA — Privilegios explícitos para funciones SECURITY DEFINER
-- PostgreSQL concede EXECUTE a PUBLIC por defecto al crear una función.

-- Funciones exclusivas del backend/service_role.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_ticket_v2(UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_to_pending_wallet(UUID, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_pending_balances() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_ticket_for_user(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_ticket_v2(UUID, UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_to_pending_wallet(UUID, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_balances() TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_ticket_for_user(UUID, UUID, TEXT) TO service_role;

-- Funciones públicas mediante sesión, nunca mediante rol anon.
REVOKE EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_ticket(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_payout(BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) TO authenticated;
