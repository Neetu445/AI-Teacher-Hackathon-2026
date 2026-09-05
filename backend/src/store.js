import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const FILE = path.join(dir, "profile.json");

function empty() {
  return {
    name: "Student",
    language: "en",
    level: "beginner",
    goal: "understand",
    knowledge: "",
    style: "patient",
    topics: [],
    scores: [],
    mastery: {},
    weak: [],
    strong: [],
    misconceptions: [],
    path: [],
  };
}

export function loadProfile() {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

export function saveProfile(p) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(p, null, 2));
  return p;
}

export function recordLesson(profile, lessonTitle, report, mastery) {
  const next = {
    ...profile,
    topics: [...new Set([lessonTitle, ...profile.topics])].slice(0, 30),
    scores: [{ title: lessonTitle, score: report.score, at: Date.now() }, ...profile.scores].slice(0, 30),
    mastery: { ...profile.mastery, ...mastery },
    weak: [...new Set([...(report.needsWork || []), ...profile.weak])].slice(0, 30),
    strong: [...new Set([...(report.mastered || []), ...profile.strong])].slice(0, 30),
    misconceptions: [...new Set([...(report.misconceptions || []), ...profile.misconceptions])].slice(0, 30),
  };
  return saveProfile(next);
}
