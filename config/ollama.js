const OLLAMA_URL = "http://localhost:11434";
const MODEL_NAME = "qwen2.5:3b";
const AI_BOT_USER_ID = "a1a1a1a1-0000-0000-0000-000000000000";

const SYSTEM_PROMPT = "You are a helpful, friendly AI assistant built into a social app called roundrobin. Keep replies conversational and reasonably concise.";

// messages: [{ role: "user"|"assistant", content }, ...] in chronological order.
// Throws on any failure (network, timeout, non-2xx) -- the caller decides the fallback.
async function getAIResponse(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // a hung local generation must not hang forever

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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

module.exports = { getAIResponse, AI_BOT_USER_ID, MODEL_NAME };
