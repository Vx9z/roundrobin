// Starts all 4 bots as separate OS processes -- real isolation, so one bot
// crashing can't take down the others. Each bot.js is also fully runnable
// standalone (node bots/catBot/bot.js); the per-bot .lock file (see
// shared/lock.js) stops the same bot from ever running twice at once
// regardless of which way it was started.
const { spawn } = require("child_process");
const path = require("path");

const botNames = ["catBot", "codeBot", "poetryBot", "sceneryBot"];

const children = botNames.map((name) => {
  const scriptPath = path.join(__dirname, name, "bot.js");
  const child = spawn(process.execPath, [scriptPath], { stdio: "inherit" });
  console.log(`[run-all] started ${name} (pid ${child.pid})`);
  child.on("exit", (code) => {
    console.log(`[run-all] ${name} exited with code ${code}`);
  });
  // Without this, a launch failure (bad path, EMFILE/EACCES under load)
  // emits an unhandled "error" event on the ChildProcess, which crashes this
  // whole supervisor by default -- exactly the kind of one-bot-takes-down-
  // the-others failure the file header above says isolation prevents.
  child.on("error", (err) => {
    console.error(`[run-all] ${name} failed to start:`, err.message);
  });
  return child;
});

// A signal sent only to this process's own pid (e.g. `taskkill /PID`,
// rather than the whole console process group) would otherwise never reach
// the children -- they'd be orphaned, keep holding their .lock files, and
// keep posting on their own timers indefinitely.
function shutdown(signal) {
  console.log(`[run-all] received ${signal}, stopping all bots...`);
  children.forEach((child) => child.kill(signal));
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
