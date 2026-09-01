const { BOTS, SERVER_URL } = require("../shared/config");
const { login, fetchImage, saveImage, createPost } = require("../shared/httpClient");
const { acquireLock } = require("../shared/lock");
const { getAIResponse } = require("../../config/ollama");

const BOT = BOTS.sceneryBot;
const INTERVAL_MS = BOT.intervalMinutes * 60 * 1000;

acquireLock(__dirname, "sceneryBot");

// Whole cycle is atomic: if any step fails, nothing gets posted this round.
async function cycle() {
  const cookie = await login(BOT.username, BOT.password);

  const { buffer, ext } = await fetchImage("https://picsum.photos/1024/768");
  const filePath = saveImage(__dirname, buffer, ext);

  const caption = await getAIResponse([
    { role: "user", content: "Write a short, peaceful one-sentence caption for a scenic nature/landscape photo. No hashtags, no quotes, under 20 words." }
  ]);

  await createPost(cookie, { content: caption.trim(), filePath });
  console.log(`[sceneryBot] posted ${filePath} at ${new Date().toISOString()}`);
}

let running = false;
async function tick() {
  if (running) {
    console.log("[sceneryBot] previous cycle still running, skipping this tick");
    return;
  }
  running = true;
  try {
    await cycle();
  } catch (err) {
    console.error("[sceneryBot] cycle failed, will retry next interval:", err.message);
  } finally {
    running = false;
  }
}

console.log(`[sceneryBot] starting, posting every ${BOT.intervalMinutes} min against ${SERVER_URL}`);
tick();
setInterval(tick, INTERVAL_MS);
