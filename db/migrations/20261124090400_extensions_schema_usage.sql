-- The vector functions (match_meme_embeddings, related_meme_embeddings,
-- search_meme_references, store_meme_embedding, private.meme_embedding_vector)
-- are SECURITY INVOKER and name extensions.vector and its operators, so the
-- role that runs them needs USAGE on schema extensions. The self-hosted
-- bootstrap granted it to the memecatch login only (deploy/postgres/
-- 99-app-identity.sql), and memecatch is NOINHERIT: after SET ROLE anon,
-- authenticated or service_role every call failed with "permission denied for
-- schema extensions". USAGE only (name lookup), not CREATE.
--
-- Rollback:
--   revoke usage on schema extensions from anon, authenticated, service_role;

grant usage on schema extensions to anon, authenticated, service_role;
