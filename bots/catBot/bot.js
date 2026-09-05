const { BOTS, SERVER_URL } = require("../shared/config");
const { login, fetchImage, saveImage, createPost } = require("../shared/httpClient");
const { acquireLock } = require("../shared/lock");
const { getAIResponse } = require("../../config/ollama");

const BOT = BOTS.catBot;
const INTERVAL_MS = BOT.intervalMinutes * 60 * 1000;

acquireLock(__dirname, "catBot");

// Whole cycle is atomic: if any step fails, nothing gets posted this round --
// never falls back to a text-only post just because the image step failed.
async function cycle() {
  const cookie = await login(BOT.username, BOT.password);

  const { buffer, ext } = await fetchImage("https://cataas.com/cat");
  const filePath = saveImage(__dirname, buffer, ext);

  const raw = await getAIResponse([
    { role: "user", content: "Write a short, fun one-sentence caption for a cute cat photo. No hashtags, no quotes, under 20 words." }
  ]);
  const caption = raw.trim();
  if (!caption) throw new Error("Ollama returned an empty caption");

  await createPost(cookie, { content: caption, filePath });
  console.log(`[catBot] posted ${filePath} at ${new Date().toISOString()}`);
}

let running = false;
async function tick() {
  if (running) {
    console.log("[catBot] previous cycle still running, skipping this tick");
    return;
  }
  running = true;
  try {
    await cycle();
  } catch (err) {
    console.error("[catBot] cycle failed, will retry next interval:", err.message);
  } finally {
    running = false;
  }
}

console.log(`[catBot] starting, posting every ${BOT.intervalMinutes} min against ${SERVER_URL}`);
tick();
setInterval(tick, INTERVAL_MS);
