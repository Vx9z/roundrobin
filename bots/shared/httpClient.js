const fs = require("fs");
const path = require("path");
const { SERVER_URL } = require("./config");

// redirect:"manual" so we can read the real 302 + Set-Cookie directly --
// confirmed live (throwaway http server test) that Node's fetch has no
// browser-style CORS/opaqueredirect taint model, so this just works here.
async function login(username, password) {
  const res = await fetch(`${SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: "manual"
  });

  const cookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const tokenMatch = cookies.map(c => c.match(/token=[^;]+/)).find(Boolean);

  if (res.status !== 302 || !tokenMatch) {
    throw new Error(`Login failed for ${username} (status ${res.status})`);
  }
  return tokenMatch[0]; // "token=<jwt>"
}

function extensionForContentType(contentType) {
  if (contentType && contentType.includes("png")) return ".png";
  if (contentType && contentType.includes("jpeg")) return ".jpg";
  if (contentType && contentType.includes("jpg")) return ".jpg";
  return ".jpg";
}

// Plain fetch, DEFAULT redirect-follow -- deliberately not the same manual-
// redirect pattern login() uses. Confirmed live that picsum.photos actually
// 302-redirects to fastly.picsum.photos; manual-redirect here would silently
// return an empty body instead of a photo.
async function fetchImage(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Image fetch failed: ${url} -> ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = extensionForContentType(res.headers.get("content-type"));
    return { buffer, ext };
  } finally {
    clearTimeout(timer);
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
  return ext === ".png" ? "image/png" : "image/jpeg";
}

// FormData/Blob multipart body -- confirmed live against a real multer route
// that Node's built-in fetch encodes this correctly with zero special
// handling needed on the receiving end. codeContent/codeLanguage map
// directly onto what postController.js's createPost already reads from
// req.body -- the same code-post path a human's compose form uses, no
// server-side changes needed.
async function createPost(cookie, { content, filePath, codeContent, codeLanguage }) {
  const form = new FormData();
  if (content) form.append("content", content);
  if (codeContent) form.append("codeContent", codeContent);
  if (codeLanguage) form.append("codeLanguage", codeLanguage);
  if (filePath) {
    const buf = await fs.promises.readFile(filePath);
    form.append("media", new Blob([buf], { type: mimeForExt(path.extname(filePath)) }), path.basename(filePath));
  }

  const res = await fetch(`${SERVER_URL}/posts`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
    redirect: "manual"
  });
  if (res.status !== 302) throw new Error(`Post failed (status ${res.status})`);
}

module.exports = { login, fetchImage, saveImage, nextImageId, createPost };
