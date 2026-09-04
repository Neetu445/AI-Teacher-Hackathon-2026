/**
 * AI Teacher - Assessment & Report Module (Node.js + Google Gemini - FREE)
 * ---------------------------------------------------------------------------
 * Ab PDF se text nikal ke usi content se quiz banega.
 * Koi server nahi - bas simple script hai, terminal mein chalti hai.
 *
 * Setup:
 *   1. npm install @google/generative-ai pdf-parse
 *   2. set GEMINI_API_KEY=tumhari-key-yaha   (CMD mein)
 *   3. Apni PDF file isi folder mein daal do (niche PDF_FILE_PATH check karo)
 *
 * Run:
 *   node assessment_report_gemini.js
 */

const fs = require("fs");
   const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3.6-flash";

// -----------------------------------------------------------
// >>> YAHA APNI PDF FILE KA NAAM DAALO <<<
// -----------------------------------------------------------
const PDF_FILE_PATH = "./ncert.pdf"; // isi folder mein PDF ka naam yaha likho

// -----------------------------------------------------------
// NAYA FUNCTION: PDF se text nikalna
// -----------------------------------------------------------
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text; // poora PDF ka text yaha milega
}

// -----------------------------------------------------------
// Helper: call Gemini and return raw text response
// -----------------------------------------------------------
async function callLLM(prompt, retries = 3) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (err) {
      const isOverloaded = err.status === 503;
      if (isOverloaded && attempt < retries) {
        const waitTime = attempt * 5000; // 5s, 10s, 15s
        console.log(`Server busy hai, ${waitTime / 1000} second wait karke retry kar rahe hain (attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw err;
      }
    }
  }
}

// -----------------------------------------------------------
// Helper: strip markdown fences (if any) and parse JSON
// -----------------------------------------------------------
function cleanJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("```")[1];
    if (cleaned.startsWith("json")) {
      cleaned = cleaned.slice(4);
    }
  }
  return JSON.parse(cleaned.trim());
}

// -----------------------------------------------------------
// STEP 1 (UPDATED): Generate quiz from PDF content (ya topic name se)
// -----------------------------------------------------------
async function generateQuizFromContent(content, level, numQuestions = 5) {
  // Bahut lamba content ho to thoda trim kar dete hain (Gemini free tier limit ke liye)
  const trimmedContent = content.slice(0, 15000);

  const prompt = `
Tum ek expert teacher ho jo quiz banate ho.

Neeche diya gaya content padho aur usi se quiz banao:
---
${trimmedContent}
---

Student level: ${level}
Number of questions: ${numQuestions}

Kaam:
- Upar diye gaye content ke important concepts cover karte hue ${numQuestions} sawal banao
- Mix rakho: kuch MCQ, kuch short-answer
- Har sawal ke sath correct answer bhi do
- Difficulty student level ke hisaab se rakho
- Sirf content mein jo likha hai wahi use karo, bahar ki knowledge mat add karo

STRICTLY sirf JSON return karo, koi extra text nahi, koi markdown fence nahi, is format mein:
{
  "topic": "content ka short title yaha likho",
  "questions": [
    {
      "id": 1,
      "concept": "concept name",
      "question": "question text",
      "type": "MCQ" or "short_answer",
      "options": ["a", "b", "c", "d"],
      "correct_answer": "correct answer text"
    }
  ]
}
`;
  const raw = await callLLM(prompt);
  return cleanJson(raw);
}

// -----------------------------------------------------------
// STEP 2: Evaluate a single student answer
// -----------------------------------------------------------
async function evaluateAnswer(question, correctAnswer, studentAnswer) {
  const prompt = `
Tum ek teacher ho jo student ka answer check kar rahe ho.

Question: ${question}
Correct Answer: ${correctAnswer}
Student's Answer: ${studentAnswer}

Kaam:
1. Bataओ answer sahi hai, galat hai, ya partially correct hai.
2. Agar galat hai, to bataओ student ka kya misconception ho sakta hai (ek line mein).

STRICTLY sirf JSON return karo, koi markdown fence nahi:
{
  "is_correct": true or false,
  "verdict": "correct" or "incorrect" or "partially_correct",
  "misconception": "agar galat hai to yaha explain karo, warna empty string"
}
`;
  const raw = await callLLM(prompt);
  return cleanJson(raw);
}

// -----------------------------------------------------------
// STEP 3: Generate final learning report
// -----------------------------------------------------------
async function generateReport(topic, evaluatedAnswers) {
  const prompt = `
Tum ek teacher ho jo student ka poora performance evaluate kar rahe ho.

Topic: ${topic}
Student ke evaluated answers: ${JSON.stringify(evaluatedAnswers)}

Kaam:
- Overall score nikaalo (percentage mein)
- Strong areas batao (jo concepts sahi answer kiye)
- Weak areas batao (jo concepts galat ya partially correct the)
- Ek chhoti recommendation do (kya revise karna chahiye)
- Next topic suggest karo jo is topic ke baad seekhna chahiye

STRICTLY sirf JSON return karo, koi markdown fence nahi, is format mein:
{
  "topic": "${topic}",
  "score_percent": 0,
  "strong_areas": [],
  "weak_areas": [],
  "recommendation": "",
  "next_topic_suggestion": ""
}
`;
  const raw = await callLLM(prompt);
  return cleanJson(raw);
}

// -----------------------------------------------------------
// DEMO / TEST RUN
// -----------------------------------------------------------
async function main() {
  const level = "beginner";

  console.log("Step 0: PDF se text nikal rahe hain...\n");
  const pdfText = await extractTextFromPDF(PDF_FILE_PATH);
  console.log(`PDF se ${pdfText.length} characters mile.\n`);

  console.log("Step 1: Generating quiz from PDF content...\n");
  const quiz = await generateQuizFromContent(pdfText, level, 3);
  console.log(JSON.stringify(quiz, null, 2));

  // --- Dummy student answers (for testing without real UI) ---
  // NOTE: Ye answers ab manually daalne padenge kyunki quiz PDF content
  // ke hisaab se badlega. Real app mein ye student se aayenge.
  const dummyAnswers = {
    1: "kuch bhi test answer",
    2: "kuch bhi test answer",
    3: "kuch bhi test answer",
  };

  console.log("\nStep 2: Evaluating student answers...\n");
  const evaluatedAnswers = [];
  for (const q of quiz.questions) {
    const studentAns = dummyAnswers[q.id] || "";
    const result = await evaluateAnswer(q.question, q.correct_answer, studentAns);
    evaluatedAnswers.push({
      concept: q.concept,
      question: q.question,
      student_answer: studentAns,
      ...result,
    });
    console.log(`Q${q.id}: ${result.verdict}`);
  }

  console.log("\nStep 3: Generating final report...\n");
  const report = await generateReport(quiz.topic, evaluatedAnswers);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => console.error("Error:", err));