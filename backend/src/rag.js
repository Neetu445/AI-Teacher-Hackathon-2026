import { embed, cosine, hasLlm } from "./llm.js";

export function chunkText(raw, name = "doc") {
  const clean = String(raw || "").replace(/\r/g, "").trim();
  const parts = clean.split(/\n{2,}|(?=^#{1,3}\s)|(?=^\d+\.\d+)/m).map((p) => p.trim()).filter((p) => p.length > 40);
  const used = parts.length ? parts : clean.match(/(.|[\n]){1,700}/g) || [clean];
  return used.slice(0, 80).map((text, i) => ({
    id: `${name}-${i}`,
    heading: text.split("\n")[0].slice(0, 100),
    text: text.slice(0, 1200),
    page: i + 1,
  }));
}

function tok(s) {
  return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

export function keywordRetrieve(query, chunks, k = 6) {
  const q = tok(query);
  return chunks
    .map((c) => {
      const set = new Set(tok(c.heading + " " + c.text));
      const score = q.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

export async function indexChunks(chunks) {
  if (!hasLlm() || !chunks.length) return chunks.map((c) => ({ ...c, embedding: null }));
  const vectors = await embed(chunks.map((c) => (c.heading + "\n" + c.text).slice(0, 800)));
  if (!vectors) return chunks;
  return chunks.map((c, i) => ({ ...c, embedding: vectors[i] }));
}

export async function retrieve(query, chunks, k = 6) {
  const withEmb = chunks.filter((c) => c.embedding);
  if (withEmb.length && hasLlm()) {
    const [q] = (await embed([query])) || [];
    if (q) {
      return withEmb
        .map((c) => ({ c, score: cosine(q, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter((x) => x.score > 0.2)
        .map((x) => x.c);
    }
  }
  return keywordRetrieve(query, chunks, k);
}
