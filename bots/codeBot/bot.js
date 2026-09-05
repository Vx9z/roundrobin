const fs = require("fs");
const path = require("path");
const { BOTS, SERVER_URL } = require("../shared/config");
const { login, createPost } = require("../shared/httpClient");
const { acquireLock } = require("../shared/lock");
const { getAIResponse } = require("../../config/ollama");
const { CODE_LANGUAGES, isValidLanguage } = require("../../config/codeLanguages");

const BOT = BOTS.codeBot;
const INTERVAL_MS = BOT.intervalMinutes * 60 * 1000;
const STATE_PATH = path.join(__dirname, "topics.json");
const MAX_CONTENT_CHARS = 300;
const MAX_CODE_CHARS = 700;
const LANGUAGE_IDS = CODE_LANGUAGES.filter(l => l.id !== "plaintext").map(l => l.id);

acquireLock(__dirname, "codeBot");

function loadState() {
  const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  if (!Array.isArray(raw.topics) || raw.topics.length === 0) {
    throw new Error("topics.json has no topics configured");
  }
  // Defensive clamp -- the topics list can be hand-edited/shrunk at any
  // time, and topicIndex itself could be dropped/malformed by a hand-edit.
  // A non-numeric topicIndex must not silently become NaN here: `NaN %
  // length` is still NaN, `topics[NaN]` is undefined, and every later
  // increment keeps operating on the same NaN with no self-recovery.
  const index = Number.isInteger(raw.topicIndex) ? raw.topicIndex : 0;
  raw.topicIndex = ((index % raw.topics.length) + raw.topics.length) % raw.topics.length;
  return raw;
}

function saveState(state) {
  // Re-read the on-disk `topics` list right before writing rather than
  // trusting the copy loaded at the start of this cycle -- a cycle takes
  // tens of seconds (two sequential Ollama calls), long enough for a
  // hand-edit to topics.json to land mid-cycle, and blindly writing back
  // the stale in-memory topics array would silently revert that edit.
  let topics = state.topics;
  try {
    const onDisk = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (Array.isArray(onDisk.topics) && onDisk.topics.length > 0) topics = onDisk.topics;
  } catch { /* unreadable/mid-write -- fall back to the in-memory list */ }

  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...state, topics }, null, 2));
}

// Finds the first top-level {...} object in the response via string-aware
// brace counting (braces inside quoted strings, e.g. a code snippet in the
// "code" field, don't affect depth) rather than a greedy regex spanning
// from the first "{" to the LAST "}" in the whole response -- the greedy
// version can swallow unrelated braces the model wrote in surrounding prose
// and fail to parse a perfectly well-formed response.
function extractJson(raw) {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(raw.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function truncate(text, max) {
  return text && text.length > max ? text.slice(0, max) : text;
}

// Only called once per topic (plannedPosts is null). Falls back to a sane
// default rather than throwing -- a bad plan-count shouldn't block posting.
async function planTopic(topic) {
  const raw = await getAIResponse([
    { role: "user", content: `You are planning a short educational post series about "${topic}" for a coding-focused social platform. Decide how many posts (an integer from 2 to 5) you want to spend on this topic before moving to something else. Respond with ONLY this JSON: {"plannedPosts": <integer>}` }
  ], undefined, "json");
  const parsed = extractJson(raw);
  const n = parsed && Number.isInteger(parsed.plannedPosts) ? parsed.plannedPosts : NaN;
  return (n >= 2 && n <= 5) ? n : 3;
}

async function writePost(topic, plannedPosts, postsSoFar, history) {
  const historyBlock = history.length
    ? history.map((h, i) => `${i + 1}. ${h}`).join("\n")
    : "(this is the first post on this topic)";

  const prompt = `You are writing post ${postsSoFar + 1} of a planned ${plannedPosts}-post series about "${topic}" for a coding-focused social platform.
What you've already covered on this topic so far:
${historyBlock}

Write the NEXT post, continuing naturally from what's already been covered -- don't repeat it. Decide for yourself whether this post needs a short code snippet or is better as plain explanation. Also decide if, after this post, you've covered "${topic}" thoroughly enough to move on to a new topic -- even if that's earlier than the original plan.

Hard limits: the post text must be under ${MAX_CONTENT_CHARS} characters. If you include code, it must be under ${MAX_CODE_CHARS} characters.

Respond with ONLY this JSON, no other text:
{"content": "...", "hasCode": true or false, "code": "..." or null, "language": one of [${LANGUAGE_IDS.join(", ")}] or null, "topicComplete": true or false, "summary": "one short line describing what this post covered"}`;

  const raw = await getAIResponse([{ role: "user", content: prompt }], undefined, "json");
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.content !== "string" || !parsed.content.trim()) {
    throw new Error("Ollama returned no usable post content");
  }

  const hasCode = !!parsed.hasCode
    && typeof parsed.code === "string" && parsed.code.trim()
    && isValidLanguage(parsed.language);

  const content = truncate(parsed.content.trim(), MAX_CONTENT_CHARS);

  return {
    content,
    codeContent: hasCode ? truncate(parsed.code.trim(), MAX_CODE_CHARS) : null,
    codeLanguage: hasCode ? parsed.language : null,
    topicComplete: parsed.topicComplete === true,
    summary: truncate(
      typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : content,
      150
    )
  };
}

// Whole cycle is atomic in the sense that matters: nothing is ever POSTED
// unless writePost produced usable content. The one deliberate exception is
// planTopic's result being saved immediately (before writePost runs) so a
// later failure this cycle doesn't waste a re-plan next time -- that's pure
// internal bookkeeping, never a partial/broken post.
async function cycle() {
  const cookie = await login(BOT.username, BOT.password);
  const state = loadState();
  const topic = state.topics[state.topicIndex];

  if (state.plannedPosts == null) {
    state.plannedPosts = await planTopic(topic);
    state.postsSoFar = 0;
    state.history = [];
    saveState(state);
  }

  const result = await writePost(topic, state.plannedPosts, state.postsSoFar, state.history);

  await createPost(cookie, {
    content: result.content,
    codeContent: result.codeContent,
    codeLanguage: result.codeLanguage
  });

  const postNumber = state.postsSoFar + 1;
  state.postsSoFar = postNumber;
  state.history.push(result.summary);

  const doneWithTopic = result.topicComplete || state.postsSoFar >= state.plannedPosts;
  if (doneWithTopic) {
    state.topicIndex = (state.topicIndex + 1) % state.topics.length;
    state.plannedPosts = null;
    state.postsSoFar = 0;
    state.history = [];
  }
  saveState(state);

  console.log(`[codeBot] posted on "${topic}" (post ${postNumber}${result.codeContent ? ", with code" : ""}${doneWithTopic ? ", topic complete" : ""}) at ${new Date().toISOString()}`);
}

let running = false;
async function tick() {
  if (running) {
    console.log("[codeBot] previous cycle still running, skipping this tick");
    return;
  }
  running = true;
  try {
    await cycle();
  } catch (err) {
    console.error("[codeBot] cycle failed, will retry next interval:", err.message);
  } finally {
    running = false;
  }
}

console.log(`[codeBot] starting, posting every ${BOT.intervalMinutes} min against ${SERVER_URL}`);
tick();
setInterval(tick, INTERVAL_MS);
