const SID = "pathshala-sid";

function id() {
  let v = localStorage.getItem(SID);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(SID, v);
  }
  return v;
}

async function req(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "x-session": id(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  start: (body) =>
    req("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  session: () => req("/api/session"),
  phase: (phase) =>
    req("/api/phase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase }),
    }),
  answer: (answer) =>
    req("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    }),
  language: (language) =>
    req("/api/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    }),
  profile: () => req("/api/profile"),
  history: () => req("/api/history"),
  followup: (question) =>
    req("/api/followup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  finish: () =>
    req("/api/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  ingest: async (file) => {
    const fd = new FormData();
    fd.set("file", file);
    return req("/api/ingest", { method: "POST", body: fd });
  },
};
