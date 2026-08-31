-- =====================================================================
-- roundrobin: optional code block on a post.
--
-- codecontent/codelanguage are a SEPARATE pair of columns from content,
-- not markdown fencing embedded inside it. Two reasons: (1) the compose UI
-- is a distinct toggle-able section, not inline syntax within the text
-- textarea, so storage should mirror that; (2) extractHashtags/
-- getTrendingHashtags/getPostsByHashtag regex-scan `content` for #(\w+) --
-- a code snippet containing "#include" or a CSS "#id{}" selector embedded
-- in content would get misparsed as a hashtag. Separate columns avoid that
-- for free.
--
-- Both nullable with no default: most posts have no code block.
--
-- Run with the app server stopped, BEFORE deploying the new model/controller.
-- sequelize.sync() will then see the columns already exist and skip them.
--   psql -U postgres -h localhost -d roundrobin -f db/add-post-code.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.posts ADD COLUMN codecontent text;
ALTER TABLE public.posts ADD COLUMN codelanguage text;

COMMIT;
