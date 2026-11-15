-- Retire the pre-billing_orders Unifi intent RPC.
--
-- The legacy function accepts a provider payment id from the browser and binds it
-- to auth.uid(). Because payment ids are provider-owned identifiers, an ordinary
-- authenticated caller could pre-claim a guessed or disclosed id before the real
-- purchaser. The current checkout flow creates billing_orders through service-role
-- RPCs and does not use this function.
--
-- Keep the function for rollback/data-forensics compatibility, but remove every
-- browser-visible EXECUTE grant. Existing migrations are intentionally untouched.

revoke all on function public.create_unifi_payment_intent(
  text, text, integer, text, boolean
) from public, anon, authenticated;
