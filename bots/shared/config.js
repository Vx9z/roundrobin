// Hardcoded and committed plainly -- matches this app's existing security
// posture (the JWT secret is the literal string "SECRET_KEY" in multiple
// files already); not introducing .env/secret-management infrastructure
// this codebase doesn't otherwise use.
const SERVER_URL = "http://localhost:3000";

const BOTS = {
  catBot: {
    username: "catBot",
    email: "catbot@roundrobin.local",
    password: "CatBot-Rr9x2Lp!",
    intervalMinutes: 5
  },
  codeBot: {
    username: "codeBot",
    email: "codebot@roundrobin.local",
    password: "CodeBot-Qz7mWk!",
    intervalMinutes: 6
  },
  poetryBot: {
    username: "poetryBot",
    email: "poetrybot@roundrobin.local",
    password: "PoetryBot-Fv3nRt!",
    intervalMinutes: 7
  },
  sceneryBot: {
    username: "sceneryBot",
    email: "scenerybot@roundrobin.local",
    password: "SceneryBot-Ht8cXe!",
    intervalMinutes: 8
  }
};

module.exports = { SERVER_URL, BOTS };
