const OLLAMA_URL = "http://localhost:11434";
const MODEL_NAME = "qwen2.5:3b";
const EMBED_MODEL_NAME = "nomic-embed-text";
const AI_BOT_USER_ID = "a1a1a1a1-0000-0000-0000-000000000000";

const SYSTEM_PROMPT = "You are a helpful, friendly AI assistant built into a social app called roundrobin. Keep replies conversational and reasonably concise.";

// messages: [{ role: "user"|"assistant", content }, ...] in chronological order.
// ragContext, if given, is a second system message injected after the base
// prompt -- keeps retrieval-augmented context separate from the assistant's
// core instructions rather than splicing it into one giant string.
// Throws on any failure (network, timeout, non-2xx) -- the caller decides the fallback.
async function getAIResponse(messages, ragContext) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // a hung local generation must not hang forever

  const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (ragContext) systemMessages.push({ role: "system", content: ragContext });

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [...systemMessages, ...messages],
        stream: false
      }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    return data.message.content;
  } finally {
    clearTimeout(timeout);
  }
}

// Returns a float vector for the given text via the local embedding model.
// Throws on any failure -- callers treat retrieval/embedding as best-effort
// and must not let it break chat generation or post creation.
async function getEmbedding(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL_NAME, input: text }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Ollama embed responded ${res.status}`);
    const data = await res.json();
    return data.embeddings[0]; // /api/embed returns one vector per input, batched
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getAIResponse, getEmbedding, AI_BOT_USER_ID, MODEL_NAME, EMBED_MODEL_NAME };
