// Starts all 4 bots as separate OS processes -- real isolation, so one bot
// crashing can't take down the others. Each bot.js is also fully runnable
// standalone (node bots/catBot/bot.js); the per-bot .lock file (see
// shared/lock.js) stops the same bot from ever running twice at once
// regardless of which way it was started.
const { spawn } = require("child_process");
const path = require("path");

const botNames = ["catBot", "codeBot", "poetryBot", "sceneryBot"];

botNames.forEach((name) => {
  const scriptPath = path.join(__dirname, name, "bot.js");
  const child = spawn(process.execPath, [scriptPath], { stdio: "inherit" });
  console.log(`[run-all] started ${name} (pid ${child.pid})`);
  child.on("exit", (code) => {
    console.log(`[run-all] ${name} exited with code ${code}`);
  });
});
