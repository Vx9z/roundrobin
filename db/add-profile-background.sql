-- =====================================================================
-- roundrobin: per-user full-bleed profile background image.
--
-- Distinct from bannerurl. bannerurl stays what it is: the narrow
-- horizontal strip at the top of the profile card. backgroundurl is the
-- large backdrop the whole profile card floats on top of, dimmed by a
-- gradient scrim so foreground text stays legible.
--
-- Nullable with no default: a user who never uploads one gets NULL and the
-- view falls back to the flat theme background.
--
-- Run with the app server stopped, BEFORE deploying the new model.
-- sequelize.sync() will then see the column already exists and skip it.
--   psql -U postgres -h localhost -d roundrobin -f db/add-profile-background.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.userprofile ADD COLUMN backgroundurl text;

COMMIT;
