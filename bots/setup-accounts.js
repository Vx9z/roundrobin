// One-off: registers the 4 bot accounts through the real /auth/register
// endpoint (same validation path a human signup gets) rather than touching
// the DB directly. Safe to re-run -- an existing account is a no-op.
// Run once, with the app server already up:
//   node bots/setup-accounts.js
const { SERVER_URL, BOTS } = require("./shared/config");

async function ensureAccount(bot) {
  const res = await fetch(`${SERVER_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: bot.username, email: bot.email, password: bot.password }).toString()
  });
  const html = await res.text();

  if (html.includes("Registration successful")) {
    console.log(`[setup] created ${bot.username}`);
  } else if (html.includes("already taken")) {
    console.log(`[setup] ${bot.username} already exists, skipping`);
  } else {
    console.warn(`[setup] unexpected response for ${bot.username} (status ${res.status}) -- check the server log`);
  }
}

(async () => {
  console.log(`[setup] registering bot accounts against ${SERVER_URL}...`);
  for (const bot of Object.values(BOTS)) {
    await ensureAccount(bot);
  }
  console.log("[setup] done.");
})().catch((err) => {
  // Without this, a rejection here (e.g. the app server isn't up yet, despite
  // the usage note above) is an unhandled rejection -- Node kills the process
  // with a raw stack trace, and any bots later in iteration order silently
  // never get registered.
  console.error("[setup] failed:", err.message);
  process.exit(1);
});
