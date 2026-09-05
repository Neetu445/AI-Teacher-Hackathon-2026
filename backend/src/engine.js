import { chatJson, hasLlm } from "./llm.js";

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

export function ruleGrade(question, answer) {
  const a = norm(answer);
  if (!a) return { correct: false, understanding: "unknown", confidence: "low" };
  if (question.type === "mcq" && question.options) {
    const idx = question.options.findIndex((o) => norm(o) === a);
    const correct = idx === question.correctIndex;
    return {
      correct,
      understanding: correct ? "understood" : question.misconceptionId ? "misconception" : "unknown",
      confidence: "high",
      misconception: correct ? null : question.misconceptionId || null,
    };
  }
  const exp = norm(question.expected || "");
  if (exp && a.includes(exp.split(" ")[0])) return { correct: true, understanding: "understood", confidence: "medium" };
  if (/not sure|maybe|i think|शायद|शायद/i.test(answer) && a.length > 8)
    return { correct: false, understanding: "partial", confidence: "low" };
  if (a.length > 12) return { correct: false, understanding: "partial", confidence: "medium" };
  return { correct: false, understanding: "unknown", confidence: "low" };
}

export async function llmGrade({ question, answer, concept, language, explanation }) {
  if (!hasLlm()) return ruleGrade(question, answer);
  try {
    const j = await chatJson(
      `You are a teacher grading one answer. JSON:
{ "correct": boolean, "partial": boolean, "understanding": "understood"|"partial"|"misconception"|"unknown",
  "confidence": "low"|"medium"|"high",
  "misconception": string|null,
  "action": "CONTINUE"|"INCREASE_DIFFICULTY"|"SIMPLIFY"|"GIVE_EXAMPLE"|"USE_ANALOGY"|"REVISIT_PREREQUISITE"|"REEXPLAIN"|"GUIDED_PROBLEM"|"RETEST",
  "status": string,
  "reexplain": string,
  "strategy": "analogy"|"example"|"simple"|"visual"|"practice" }
status and reexplain MUST be in language ${language}.
If the Ohm/current/resistance inverse is inverted, action USE_ANALOGY and name the misconception.`,
      JSON.stringify({ question, answer, conceptTitle: concept.title, explanation })
    );
    if (j?.understanding) return j;
  } catch (e) {
    console.error("grade llm", e.message);
  }
  return ruleGrade(question, answer);
}

function ruleDecide(g, concept, lang) {
  const hi = lang === "hi";
  if (g.understanding === "understood") {
    return {
      ...g,
      action: "CONTINUE",
      strategy: "practice",
      status: hi ? "स्पष्ट है। आगे बढ़ते हैं।" : "You understand this. We'll continue.",
    };
  }
  if (g.understanding === "partial") {
    return {
      ...g,
      action: "GIVE_EXAMPLE",
      strategy: "example",
      status: hi ? "लगभग सही। उदाहरण से देखते हैं।" : "You're close. Let's use an example.",
      reexplain: concept.example,
    };
  }
  if (g.understanding === "misconception" || concept.question?.misconceptionId === "current_increases_with_R") {
    return {
      ...g,
      action: "USE_ANALOGY",
      strategy: "analogy",
      misconception: g.misconception || concept.question?.misconceptionId,
      status: hi
        ? "मैंने ध्यान दिया: धारा और प्रतिरोध उल्टे जुड़ रहे हैं। पानी-पाइप से समझाती हूँ।"
        : "I noticed you're mixing up current and resistance. Let's use a water-pipe analogy.",
      reexplain: concept.analogy,
    };
  }
  return {
    ...g,
    action: "SIMPLIFY",
    strategy: "simple",
    status: hi ? "सरल भाषा में दोबारा।" : "I'll explain more simply.",
    reexplain: concept.simple,
  };
}

export async function applyAnswer(state, answer) {
  const concept = state.lesson.concepts[state.conceptIndex];
  const q =
    state.phase === "recheck"
      ? concept.followUp || concept.question
      : state.phase === "harder"
        ? concept.harder || concept.followUp || concept.question
        : concept.question;

  const g = await llmGrade({
    question: q,
    answer,
    concept,
    language: state.lesson.language,
    explanation: concept.explanation,
  });
  const decision = g.action ? g : ruleDecide(g, concept, state.lesson.language);

  const mastery = { ...state.mastery };
  if (decision.understanding === "understood") mastery[concept.id] = "mastered";
  else mastery[concept.id] = "needs_practice";

  const logs = [...state.logs, { conceptId: concept.id, answer, ...decision }];

  let { phase, conceptIndex } = state;
  const last = state.lesson.concepts.length - 1;

  if (decision.understanding === "understood") {
    if (decision.action === "INCREASE_DIFFICULTY" && concept.harder && state.phase !== "harder") {
      phase = "harder";
    } else if (conceptIndex >= last) phase = "assess";
    else {
      conceptIndex += 1;
      phase = "explain";
      mastery[state.lesson.concepts[conceptIndex].id] = "learning";
    }
  } else if (state.phase === "question") {
    phase = "remediate";
  } else if (state.phase === "recheck" || state.phase === "harder") {
    if (conceptIndex >= last) phase = "assess";
    else {
      conceptIndex += 1;
      phase = "explain";
    }
  } else {
    phase = "remediate";
  }

  return {
    ...state,
    conceptIndex,
    phase,
    mastery,
    logs,
    lastDecision: decision,
    lastReexplain: decision.reexplain || concept.analogy,
  };
}
