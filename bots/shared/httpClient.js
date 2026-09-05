const fs = require("fs");
const path = require("path");
const cookie = require("cookie");
const { SERVER_URL } = require("./config");

const REQUEST_TIMEOUT_MS = 20000;

// Every request against the app server gets the same abort-on-hang behavior
// fetchImage/getAIResponse already had -- without this, a hung server
// response leaves cycle() awaiting forever, and since tick()'s `running`
// guard only resets after cycle() settles, the whole bot wedges for good.
function withTimeout(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// redirect:"manual" so we can read the real 302 + Set-Cookie directly --
// confirmed live (throwaway http server test) that Node's fetch has no
// browser-style CORS/opaqueredirect taint model, so this just works here.
async function login(username, password) {
  const { signal, clear } = withTimeout();
  try {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }).toString(),
      redirect: "manual",
      signal
    });

    const setCookies = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
    // Same cookie-parsing library config/socket.js already uses for this
    // exact "auth token out of a raw Cookie/Set-Cookie header" job, instead
    // of a hand-rolled regex that could mismatch a differently-named cookie.
    const token = setCookies.map(c => cookie.parse(c).token).find(Boolean);

    if (res.status !== 302 || !token) {
      throw new Error(`Login failed for ${username} (status ${res.status})`);
    }
    return `token=${token}`;
  } finally {
    clear();
  }
}

function extensionForContentType(contentType) {
  if (contentType && contentType.includes("png")) return ".png";
  if (contentType && contentType.includes("webp")) return ".webp";
  if (contentType && contentType.includes("gif")) return ".gif";
  if (contentType && (contentType.includes("jpeg") || contentType.includes("jpg"))) return ".jpg";
  return ".jpg";
}

// Plain fetch, DEFAULT redirect-follow -- deliberately not the same manual-
// redirect pattern login() uses. Confirmed live that picsum.photos actually
// 302-redirects to fastly.picsum.photos; manual-redirect here would silently
// return an empty body instead of a photo.
async function fetchImage(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Image fetch failed: ${url} -> ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = extensionForContentType(res.headers.get("content-type"));
    return { buffer, ext };
  } finally {
    clear();
  }
}

// Scans a bot's own directory for existing numbered image files and returns
// the next id -- no separate counter file to go stale across restarts.
function nextImageId(botDir) {
  const existing = fs.readdirSync(botDir)
    .map(f => parseInt(f, 10))
    .filter(n => Number.isInteger(n));
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

function saveImage(botDir, buffer, ext) {
  const filePath = path.join(botDir, `${nextImageId(botDir)}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function mimeForExt(ext) {
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

// FormData/Blob multipart body -- confirmed live against a real multer route
// that Node's built-in fetch encodes this correctly with zero special
// handling needed on the receiving end. codeContent/codeLanguage map
// directly onto what postController.js's createPost already reads from
// req.body -- the same code-post path a human's compose form uses, no
// server-side changes needed.
async function createPost(cookieHeader, { content, filePath, codeContent, codeLanguage }) {
  const form = new FormData();
  if (content) form.append("content", content);
  if (codeContent) form.append("codeContent", codeContent);
  if (codeLanguage) form.append("codeLanguage", codeLanguage);
  if (filePath) {
    const buf = await fs.promises.readFile(filePath);
    form.append("media", new Blob([buf], { type: mimeForExt(path.extname(filePath)) }), path.basename(filePath));
  }

  const { signal, clear } = withTimeout();
  let res;
  try {
    res = await fetch(`${SERVER_URL}/posts`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: form,
      redirect: "manual",
      signal
    });
  } finally {
    clear();
  }

  // postController.js's createPost redirects with 302 on BOTH success (to
  // /feed) and a missing/invalid session (to /login) -- status alone can't
  // tell them apart, so an expired cookie would otherwise look like a
  // successful post. Location is checked too.
  const location = res.headers.get("location") || "";
  if (res.status !== 302 || location.includes("/login")) {
    throw new Error(`Post failed (status ${res.status}, redirected to "${location}")`);
  }
}

module.exports = { login, fetchImage, saveImage, nextImageId, createPost };
