-- pgcrypto is installed in the extensions schema on hosted Supabase.

begin;
alter function public.complete_seo_campaign_item(
  uuid, integer, timestamptz, uuid, jsonb, jsonb
) set search_path = public, extensions;
commit;
