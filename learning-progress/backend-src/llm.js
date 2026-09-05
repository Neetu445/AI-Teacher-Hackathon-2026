const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const EMBED = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

export function hasLlm() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chatJson(system, user) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("LLM error " + res.status + " " + t.slice(0, 200));
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}

export async function embed(texts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED, input: texts }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

export function cosine(a, b) {
  let s = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}
