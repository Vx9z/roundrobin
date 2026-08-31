-- =====================================================================
-- roundrobin: seed the AI Assistant bot user.
-- Fixed UUID so it can be hardcoded as a constant in JS (config/ollama.js)
-- without a lookup-by-username query on every message. Idempotent -- safe
-- to run more than once.
--   psql -U postgres -h localhost -d roundrobin -f db/seed-ai-user.sql
-- =====================================================================

INSERT INTO users (userid, username, email, passwordhash, clearancelevel)
VALUES (
  'a1a1a1a1-0000-0000-0000-000000000000',
  'AI Assistant',
  NULL,
  -- bcrypt hash of a random 32-byte string, never shared -- a login attempt
  -- against this account always fails safely via a normal bcrypt mismatch.
  '$2b$10$kdDRUEJjwoBb/MzBFZsn3e89FZow5bdYUxWFS/3GBKiVIbJxJ5WMe',
  0
)
ON CONFLICT (userid) DO NOTHING;
