import { ohmsLesson } from "./ohms.js";
import { chatJson, hasLlm } from "./llm.js";
import { retrieve } from "./rag.js";

const PLAN_SYS = `You are Pathshala, an expert lesson planner for an AI Teacher.
Return JSON:
{
  "title": string,
  "intro": string,
  "objective": string,
  "nextTopic": string,
  "path": string[],
  "concepts": [{
    "id": string,
    "title": string,
    "minutes": number,
    "explanation": string,
    "simple": string,
    "example": string,
    "analogy": string,
    "visual": { "type": "equation"|"steps"|"circuit"|"process"|"timeline"|"code"|"diagram"|"board", "title": string, "steps": string[], "bullets": string[], "formula": string, "code": string },
    "question": { "id": string, "type": "mcq"|"short"|"concept", "prompt": string, "options": string[], "correctIndex": number, "expected": string, "misconceptionId": string },
    "followUp": { "id": string, "type": "mcq"|"short", "prompt": string, "options": string[], "correctIndex": number, "expected": string },
    "harder": { "id": string, "type": "mcq"|"short", "prompt": string, "options": string[], "correctIndex": number },
    "citation": string
  }]
}
Rules:
- Teach in the student's language: en, hi, or hinglish. Entire spoken fields in that language.
- Fit concept count to minutes: 5min=1, 15-20min=2-3, 30min=3-4, 60min=5, 7 days=path of 6-8 sessions in "path".
- Beginner: analogies. Intermediate: practical. Advanced: technical.
- Ground explanations in provided chunks. citation must quote chunk heading or "general knowledge" if none.
- Always include one misconception-prone MCQ.
- visual.type must match subject.`;

export async function planLesson(setup, chunks = []) {
  const minutes = Number(setup.minutes) || 15;
  const lang = setup.language || "en";
  const topic = setup.topic || "the topic";
  const hits = await retrieve(topic + " " + (setup.goal || "") + " " + (setup.knowledge || ""), chunks, 8);

  if (hasLlm()) {
    try {
      const planned = await chatJson(
        PLAN_SYS,
        JSON.stringify({
          setup: {
            topic,
            level: setup.level,
            knowledge: setup.knowledge,
            goal: setup.goal,
            minutes,
            language: lang,
            style: setup.style,
            historyWeak: setup.weak || [],
          },
          chunks: hits.map((c) => ({ heading: c.heading, text: c.text, page: c.page })),
        })
      );
      if (planned?.concepts?.length) {
        return {
          ...planned,
          id: "llm",
          language: lang,
          minutes,
          grounded: hits.length > 0,
          usedLlm: true,
          concepts: planned.concepts,
          path: planned.path?.length ? planned.path : planned.concepts.map((c) => c.title),
          nextTopic: planned.nextTopic || "Practice problems",
        };
      }
    } catch (e) {
      console.error("planner llm", e.message);
    }
  }

  const ohm = setup.demo || /ohm|electric|current|resistance|voltage|विद्युत|ओम/i.test(topic);
  if (ohm) {
    const l = ohmsLesson(lang, minutes);
    l.usedLlm = false;
    l.grounded = true;
    return l;
  }

  return fallbackTopic(setup, hits);
}

function fallbackTopic(setup, hits) {
  const n = setup.minutes <= 5 ? 1 : setup.minutes <= 20 ? 2 : 3;
  const bits = hits.length ? hits : [{ heading: setup.topic, text: setup.topic, page: 1 }];
  const lang = setup.language;
  const concepts = bits.slice(0, n).map((h, i) => ({
    id: "c" + i,
    title: h.heading.slice(0, 70),
    minutes: Math.round(setup.minutes / n),
    explanation: h.text.slice(0, 400),
    simple: h.text.slice(0, 180),
    example: "Worked example of " + h.heading,
    analogy: "Relate " + h.heading + " to something everyday.",
    visual: { type: "board", title: h.heading, steps: h.text.split(". ").slice(0, 3) },
    question: {
      id: "q" + i,
      type: "short",
      prompt: lang === "hi" ? `${h.heading} क्या है?` : `What is ${h.heading}?`,
      expected: h.heading.split(" ")[0],
    },
    followUp: {
      id: "qf" + i,
      type: "short",
      prompt: lang === "hi" ? "एक वाक्य में दोहराएँ" : "Say it in one sentence",
      expected: h.heading.split(" ")[0],
    },
    harder: {
      id: "qh" + i,
      type: "short",
      prompt: "Apply this idea to a new situation.",
    },
    citation: hits.length ? `Upload p.${h.page}` : "general knowledge",
  }));
  return {
    id: "fallback",
    title: setup.topic,
    intro: `Fallback planner (${setup.minutes} min, ${setup.level}). Add OPENAI_API_KEY for full AI planning.`,
    objective: "Understand the core ideas",
    nextTopic: "Practice",
    path: concepts.map((c) => c.title),
    language: setup.language,
    minutes: setup.minutes,
    grounded: hits.length > 0,
    usedLlm: false,
    concepts,
  };
}
