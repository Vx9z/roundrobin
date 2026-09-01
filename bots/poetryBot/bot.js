const { BOTS, SERVER_URL } = require("../shared/config");
const { login, createPost } = require("../shared/httpClient");
const { acquireLock } = require("../shared/lock");
const { getAIResponse } = require("../../config/ollama");

const BOT = BOTS.poetryBot;
const INTERVAL_MS = BOT.intervalMinutes * 60 * 1000;

acquireLock(__dirname, "poetryBot");

// Never trusts the model to have actually followed the line-count
// instruction on its own -- truncates programmatically regardless.
function capToSixLines(text) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}

async function cycle() {
  const cookie = await login(BOT.username, BOT.password);

  const raw = await getAIResponse([
    { role: "user", content: "Write a short original poem, no more than 6 lines, on any theme you like. Return ONLY the poem text -- no title, no explanation, no markdown." }
  ]);
  const poem = capToSixLines(raw);
  if (!poem) throw new Error("Ollama returned an empty poem");

  await createPost(cookie, { content: poem }); // text only, no image
  console.log(`[poetryBot] posted at ${new Date().toISOString()}`);
}

let running = false;
async function tick() {
  if (running) {
    console.log("[poetryBot] previous cycle still running, skipping this tick");
    return;
  }
  running = true;
  try {
    await cycle();
  } catch (err) {
    console.error("[poetryBot] cycle failed, will retry next interval:", err.message);
  } finally {
    running = false;
  }
}

console.log(`[poetryBot] starting, posting every ${BOT.intervalMinutes} min against ${SERVER_URL}`);
tick();
setInterval(tick, INTERVAL_MS);
