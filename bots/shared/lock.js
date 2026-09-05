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
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // "wx" is an OS-level atomic exclusive create: it fails with EEXIST if
      // the file already exists. Unlike a separate existsSync-then-
      // writeFileSync pair, there's no window between "check" and "write"
      // for a second process to slip through -- whichever process's open()
      // call actually lands first is the only one that can win.
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);

      const release = () => { try { fs.unlinkSync(lockPath); } catch { /* already gone, fine */ } };
      process.on("exit", release);
      process.on("SIGINT", () => { release(); process.exit(0); });
      process.on("SIGTERM", () => { release(); process.exit(0); });
      return;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;

      const pid = parseInt(fs.readFileSync(lockPath, "utf8"), 10);
      if (pid && isProcessAlive(pid)) {
        console.error(`[${botName}] already running (pid ${pid}) -- refusing to start a second instance`);
        process.exit(1);
      }
      // Stale lock from a process that crashed/was killed -- reclaim it and
      // retry the atomic create. If another process reclaims it first, the
      // next loop iteration's liveness check catches that correctly.
      try { fs.unlinkSync(lockPath); } catch { /* someone else already reclaimed it -- loop and recheck */ }
    }
  }

  throw new Error(`[${botName}] could not acquire lock at ${lockPath} after ${maxAttempts} attempts`);
}

module.exports = { acquireLock };
