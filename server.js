const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL_NAME = "gemini-3.6-flash";

// --------------------------------------------------
// Gemini helper
// --------------------------------------------------

async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

// --------------------------------------------------
// Generate Quiz
// --------------------------------------------------

async function generateQuiz(content, level = "beginner", numberOfQuestions = 5) {
  const prompt = `
You are an AI Teacher assessment generator.

Create ${numberOfQuestions} questions from the educational content below.

Student level: ${level}

IMPORTANT:
- Questions MUST be based only on the provided content.
- Do not use outside information.
- Cover different concepts from the content.
- Give each question a concept name.
- Include the correct answer.
- Include marks.

Return ONLY valid JSON in this format:

{
  "questions": [
    {
      "id": 1,
      "question": "Question here",
      "concept": "Concept name",
      "type": "short_answer",
      "correctAnswer": "Correct answer",
      "marks": 2
    }
  ]
}

EDUCATIONAL CONTENT:
${content}
`;

  return await callGemini(prompt);
}

// --------------------------------------------------
// Evaluate Student Answer
// --------------------------------------------------

async function evaluateAnswer(
  question,
  correctAnswer,
  studentAnswer,
  maxMarks
) {
  const prompt = `
You are an AI Teacher evaluating a student's answer.

Question:
${question}

Correct Answer:
${correctAnswer}

Student Answer:
${studentAnswer}

Maximum Marks:
${maxMarks}

Evaluate the student's answer fairly.

Return ONLY valid JSON:

{
  "marks": 0,
  "verdict": "correct",
  "feedback": "Short useful feedback",
  "misconception": "Mention the misunderstanding if there is one"
}

Rules:
- marks must be between 0 and ${maxMarks}
- "correct" if the answer is essentially correct
- "partial" if some understanding is correct
- "incorrect" if the answer is wrong
`;

  return await callGemini(prompt);
}

// --------------------------------------------------
// Calculate Score
// --------------------------------------------------

function calculateScore(evaluatedAnswers) {
  let obtainedMarks = 0;
  let totalMarks = 0;

  evaluatedAnswers.forEach((answer) => {
    obtainedMarks += Number(answer.marks) || 0;
    totalMarks += Number(answer.maxMarks) || 0;
  });

  const percentage =
    totalMarks === 0
      ? 0
      : Math.round((obtainedMarks / totalMarks) * 100);

  return {
    obtainedMarks,
    totalMarks,
    percentage,
  };
}

// --------------------------------------------------
// Identify Weak Areas + Recommendations
// --------------------------------------------------

async function generateReport(evaluatedAnswers, score) {
  const prompt = `
You are an AI Teacher analyzing a student's assessment.

Overall Score:
${score.obtainedMarks}/${score.totalMarks}

Percentage:
${score.percentage}%

Question performance:
${JSON.stringify(evaluatedAnswers, null, 2)}

Identify:
1. Strong concepts
2. Weak concepts
3. Why the student is weak in those concepts
4. Personalized study tips
5. What the student should revise
6. What they should practice next

Return ONLY valid JSON:

{
  "strongAreas": [],
  "weakAreas": [],
  "recommendations": [],
  "nextStep": ""
}
`;

  return await callGemini(prompt);
}

// --------------------------------------------------
// Test Route
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "AI Teacher Assessment Backend is running!",
  });
});

// --------------------------------------------------
// Generate Quiz API
// --------------------------------------------------

app.post("/generate-quiz", async (req, res) => {
  try {
    const {
      content,
      level = "beginner",
      numberOfQuestions = 5,
    } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "Educational content is required.",
      });
    }

    const quiz = await generateQuiz(
      content,
      level,
      numberOfQuestions
    );

    res.json(quiz);
  } catch (error) {
    console.error("Quiz generation error:", error);

    res.status(500).json({
      error: "Failed to generate quiz.",
      details: error.message,
    });
  }
});

// --------------------------------------------------
// Evaluate Assessment API
// --------------------------------------------------

app.post("/evaluate", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: "Answers array is required.",
      });
    }

    const evaluatedAnswers = [];

    for (const answer of answers) {
      const evaluation = await evaluateAnswer(
        answer.question,
        answer.correctAnswer,
        answer.studentAnswer,
        answer.maxMarks
      );

      evaluatedAnswers.push({
        question: answer.question,
        concept: answer.concept,
        studentAnswer: answer.studentAnswer,
        maxMarks: answer.maxMarks,
        marks: evaluation.marks,
        verdict: evaluation.verdict,
        feedback: evaluation.feedback,
        misconception: evaluation.misconception,
      });
    }

    const score = calculateScore(evaluatedAnswers);

    const report = await generateReport(
      evaluatedAnswers,
      score
    );

    res.json({
      score,
      evaluatedAnswers,
      report,
    });
  } catch (error) {
    console.error("Evaluation error:", error);

    res.status(500).json({
      error: "Failed to evaluate assessment.",
      details: error.message,
    });
  }
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`AI Teacher server running at http://localhost:${PORT}`);
});