const fs = require("fs");
const path = require("path");

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // standard no-op liveness check -- doesn't actually signal anything
    return true;
  } catch {
    return false;
  }
}

// Closes a real concurrency hole: every bot.js is both spawned by run-all.js
// AND independently runnable on its own, so nothing otherwise stops two live
// processes for the same bot existing at once -- both scanning/writing the
// same image directory, both logged in as the same account, doubling load
// and posts. Refuses to start a second instance while a live one holds the
// lock; reclaims a stale lock left behind by a crashed process.
function acquireLock(botDir, botName) {
  const lockPath = path.join(botDir, ".lock");

  if (fs.existsSync(lockPath)) {
    const pid = parseInt(fs.readFileSync(lockPath, "utf8"), 10);
    if (pid && isProcessAlive(pid)) {
      console.error(`[${botName}] already running (pid ${pid}) -- refusing to start a second instance`);
      process.exit(1);
    }
    // stale lock from a process that crashed/was killed -- safe to reclaim
  }

  fs.writeFileSync(lockPath, String(process.pid));

  const release = () => { try { fs.unlinkSync(lockPath); } catch { /* already gone, fine */ } };
  process.on("exit", release);
  process.on("SIGINT", () => { release(); process.exit(0); });
  process.on("SIGTERM", () => { release(); process.exit(0); });
}

module.exports = { acquireLock };
