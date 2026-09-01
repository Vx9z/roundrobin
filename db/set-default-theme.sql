-- =====================================================================
-- roundrobin: make the VS Code-styled dark theme (id 2, "vscode-dark") the
-- default for brand-new profiles, matching config/themes.js's DEFAULT_THEME.
--
-- Only changes the column DEFAULT, which applies to future INSERTs -- does
-- NOT retroactively touch any existing row's stored themeid, including rows
-- that only have 0 because that was the old default. Existing users keep
-- whatever they already have (explicit or not); only accounts created after
-- this migration start on vscode-dark.
--
-- Run with the app server stopped.
--   psql -U postgres -h localhost -d roundrobin -f db/set-default-theme.sql
-- =====================================================================

BEGIN;

ALTER TABLE public.userprofile ALTER COLUMN themeid SET DEFAULT 2;

COMMIT;
