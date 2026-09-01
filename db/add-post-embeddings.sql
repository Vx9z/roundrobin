-- =====================================================================
-- roundrobin: per-post embedding vector for the AI assistant's rudimentary
-- RAG retrieval.
--
-- Stored as plain jsonb (a JSON float array), not a pgvector column --
-- pgvector is not installed on this Postgres instance. Similarity is
-- computed in JS over candidate rows (controllers/postController.js's
-- getRelevantPosts), the same "tally-and-sort in plain JS" approach already
-- used for trending hashtags and suggested posts. Fine at this app's scale.
--
-- Nullable, no default: posts with no text content (media/code-only) never
-- get one, and existing posts stay NULL until scripts/backfill-post-
-- embeddings.js is run once by hand.
--
-- Run with the app server stopped, BEFORE deploying the new model/controller.
--   psql -U postgres -h localhost -d roundrobin -f db/add-post-embeddings.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.posts ADD COLUMN embedding jsonb;

COMMIT;
