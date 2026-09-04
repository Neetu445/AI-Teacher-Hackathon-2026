const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3000;

// =====================================================
// GEMINI API KEY
// =====================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

const MODEL_NAME = "gemini-3.6-flash";

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "2mb" }));

app.use(
  express.static(path.join(__dirname, "public"))
);

// =====================================================
// UPLOAD FOLDER
// =====================================================

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =====================================================
// MULTER CONFIGURATION
// =====================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      file.originalname.replace(/\s+/g, "_");

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {

    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }

  }
});

// =====================================================
// GEMINI HELPER
// =====================================================

async function callGemini(prompt) {

  if (
    !GEMINI_API_KEY ||
    GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE"
  ) {
    throw new Error(
      "Gemini API key is missing. Please add your API key in server.js."
    );
  }

  const response =
    await ai.models.generateContent({

      model: MODEL_NAME,

      contents: prompt,

      config: {
        responseMimeType: "application/json"
      }

    });

  let text = response.text;

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  // Remove markdown code fences if Gemini adds them
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {

    return JSON.parse(text);

  } catch (error) {

    console.error(
      "Invalid JSON received from Gemini:"
    );

    console.error(text);

    throw new Error(
      "Gemini returned invalid JSON."
    );
  }
}

// =====================================================
// PDF TEXT EXTRACTION
// =====================================================

async function extractTextFromPDF(filePath) {

  const dataBuffer =
    fs.readFileSync(filePath);

  const pdfData =
    await pdfParse(dataBuffer);

  const text =
    pdfData.text
      .replace(/\s+/g, " ")
      .trim();

  if (!text) {

    throw new Error(
      "Could not extract readable text from this PDF."
    );
  }

  return text;
}

// =====================================================
// GENERATE QUIZ
// =====================================================

async function generateQuiz(
  content,
  level,
  numberOfQuestions
) {

  // Limit content sent to Gemini
  const limitedContent =
    content.substring(0, 30000);

  const prompt = `
You are an AI Teacher and assessment generator.

Study the educational material provided below.

Create a quiz based ONLY on the uploaded educational material.

Student level:
${level}

Number of questions:
${numberOfQuestions}

IMPORTANT RULES:

1. Every question must be based on the uploaded material.
2. Do not invent facts that are not present in the material.
3. Cover different important concepts when possible.
4. Match the difficulty to the student's level.
5. Use both MCQ and short-answer questions.
6. MCQ questions must have exactly 4 options.
7. Short-answer questions must have an empty options array.
8. Every question must have one correct answer.
9. Assign reasonable marks according to difficulty.
10. Include the concept being tested.

Return ONLY valid JSON.

Required format:

{
  "questions": [
    {
      "question": "Question text",
      "concept": "Concept being tested",
      "type": "MCQ",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswer": "Correct option",
      "marks": 1
    }
  ]
}

For a short-answer question:

{
  "question": "Question text",
  "concept": "Concept being tested",
  "type": "SHORT",
  "options": [],
  "correctAnswer": "Expected answer",
  "marks": 2
}

Uploaded educational material:

${limitedContent}
`;

  return await callGemini(prompt);
}

// =====================================================
// EVALUATE ONE ANSWER
// =====================================================

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
${studentAnswer || "No answer provided"}

Maximum Marks:
${maxMarks}

Evaluate the student's answer fairly.

For MCQ:
- Correct answer = full marks
- Incorrect answer = 0 marks

For short-answer:
- Full marks if the key concept is correctly understood.
- Partial marks if the answer is partially correct.
- 0 marks if the answer is incorrect or unrelated.

Also identify any misconception.

Return ONLY valid JSON in this format:

{
  "marksObtained": 0,
  "verdict": "Correct",
  "feedback": "Short helpful feedback",
  "misconception": "None"
}

marksObtained must be between 0 and ${maxMarks}.
`;

  return await callGemini(prompt);
}

// =====================================================
// CALCULATE SCORE
// =====================================================

function calculateScore(results) {

  let obtainedMarks = 0;
  let totalMarks = 0;

  results.forEach(result => {

    const maxMarks =
      Number(result.maxMarks) || 0;

    const marksObtained =
      Math.min(
        Math.max(
          Number(result.marksObtained) || 0,
          0
        ),
        maxMarks
      );

    totalMarks += maxMarks;

    obtainedMarks += marksObtained;
  });

  const percentage =
    totalMarks > 0
      ? Number(
          (
            (obtainedMarks / totalMarks) *
            100
          ).toFixed(2)
        )
      : 0;

  return {
    obtainedMarks,
    totalMarks,
    percentage
  };
}

// =====================================================
// GENERATE PERFORMANCE REPORT
// =====================================================

async function generateReport(
  results,
  score
) {

  const performanceData =
    results.map(result => ({

      question:
        result.question,

      concept:
        result.concept,

      studentAnswer:
        result.studentAnswer,

      correctAnswer:
        result.correctAnswer,

      marksObtained:
        result.marksObtained,

      maxMarks:
        result.maxMarks,

      verdict:
        result.verdict,

      misconception:
        result.misconception

    }));

  const prompt = `
You are an AI Teacher analyzing a student's assessment performance.

Assessment Score:
${score.obtainedMarks}/${score.totalMarks}

Percentage:
${score.percentage}%

Question-wise performance:

${JSON.stringify(
  performanceData,
  null,
  2
)}

Analyze the student's understanding.

Identify:

1. Strong concepts
2. Weak concepts
3. Specific practical recommendations
4. Topics that should be revised
5. Concepts that should be tested again
6. The best next learning step

Your recommendations must be personalized according to the student's actual performance.

Return ONLY valid JSON:

{
  "strongAreas": [
    "Concept 1"
  ],

  "weakAreas": [
    "Concept 2"
  ],

  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],

  "revisionTopics": [
    "Topic 1"
  ],

  "retestConcepts": [
    "Concept 2"
  ],

  "nextStep": "What the student should study next"
}
`;

  return await callGemini(prompt);
}

// =====================================================
// HOME PAGE
// =====================================================

app.get("/", (req, res) => {

  const indexPath =
    path.join(
      __dirname,
      "public",
      "index.html"
    );

  if (!fs.existsSync(indexPath)) {

    return res.send(`
      <h1>AI Teacher Backend is Running</h1>
      <p>But public/index.html was not found.</p>
      <p>Please create a public folder and put index.html inside it.</p>
    `);
  }

  res.sendFile(indexPath);
});

// =====================================================
// API STATUS
// =====================================================

app.get("/api/status", (req, res) => {

  res.json({

    status: "running",

    message:
      "AI Teacher Assessment Backend is running!",

    model: MODEL_NAME

  });

});

// =====================================================
// GENERATE QUIZ API
// =====================================================

app.post(
  "/generate-quiz",
  upload.single("document"),

  async (req, res) => {

    let uploadedFilePath = null;

    try {

      // Check uploaded file
      if (!req.file) {

        return res.status(400).json({

          success: false,

          error:
            "Please upload a PDF document."

        });
      }

      uploadedFilePath =
        req.file.path;

      // Student level
      const level =
        req.body.level ||
        "beginner";

      // Number of questions
      const numberOfQuestions =
        Number(
          req.body.numberOfQuestions
        ) || 5;

      // Validate question count
      if (
        numberOfQuestions < 1 ||
        numberOfQuestions > 20
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Number of questions must be between 1 and 20."

        });
      }

      console.log(
        `Reading PDF: ${req.file.originalname}`
      );

      // Extract PDF text
      const content =
        await extractTextFromPDF(
          uploadedFilePath
        );

      console.log(
        `Extracted ${content.length} characters.`
      );

      // Generate quiz
      console.log(
        "Generating quiz with Gemini..."
      );

      const quiz =
        await generateQuiz(
          content,
          level,
          numberOfQuestions
        );

      console.log(
        "Quiz generated successfully."
      );

      // Delete temporary PDF
      if (
        uploadedFilePath &&
        fs.existsSync(uploadedFilePath)
      ) {

        fs.unlink(
          uploadedFilePath,
          err => {

            if (err) {

              console.error(
                "Could not delete temporary file:",
                err.message
              );

            }

          }
        );
      }

      res.json({

        success: true,

        message:
          "Quiz generated successfully.",

        level: level,

        quiz: quiz

      });

    } catch (error) {

      console.error(
        "Generate Quiz Error:",
        error
      );

      // Delete temporary file
      if (
        uploadedFilePath &&
        fs.existsSync(uploadedFilePath)
      ) {

        fs.unlink(
          uploadedFilePath,
          () => {}
        );
      }

      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Quiz generation failed."

      });
    }
  }
);

// =====================================================
// EVALUATE QUIZ API
// =====================================================

app.post(
  "/evaluate",

  async (req, res) => {

    try {

      const {
        questions,
        answers
      } = req.body;

      // Validate arrays
      if (
        !Array.isArray(questions) ||
        !Array.isArray(answers)
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Questions and answers arrays are required."

        });
      }

      if (
        questions.length === 0 ||
        questions.length !== answers.length
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Questions and answers must have the same length."

        });
      }

      console.log(
        `Evaluating ${questions.length} answers...`
      );

      const evaluationResults = [];

      // Evaluate every answer
      for (
        let i = 0;
        i < questions.length;
        i++
      ) {

        const question =
          questions[i];

        const studentAnswer =
          answers[i]?.answer || "";

        console.log(
          `Evaluating question ${i + 1}...`
        );

        const maxMarks =
          Number(question.marks) || 1;

        const evaluation =
          await evaluateAnswer(

            question.question,

            question.correctAnswer,

            studentAnswer,

            maxMarks

          );

        evaluationResults.push({

          question:
            question.question,

          concept:
            question.concept,

          studentAnswer:
            studentAnswer,

          correctAnswer:
            question.correctAnswer,

          marksObtained:
            evaluation.marksObtained,

          maxMarks:
            maxMarks,

          verdict:
            evaluation.verdict,

          feedback:
            evaluation.feedback,

          misconception:
            evaluation.misconception

        });
      }

      // Calculate score
      const score =
        calculateScore(
          evaluationResults
        );

      console.log(
        `Score: ${score.obtainedMarks}/${score.totalMarks}`
      );

      // Generate AI performance analysis
      console.log(
        "Generating performance analysis..."
      );

      const performanceAnalysis =
        await generateReport(
          evaluationResults,
          score
        );

      console.log(
        "Performance analysis generated."
      );

      res.json({

        success: true,

        score: score,

        results:
          evaluationResults,

        performanceAnalysis:
          performanceAnalysis

      });

    } catch (error) {

      console.error(
        "Evaluation Error:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          error.message ||
          "Evaluation failed."

      });
    }
  }
);

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (error, req, res, next) => {

    console.error(
      "Server Error:",
      error
    );

    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code === "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({

          success: false,

          error:
            "PDF size must be less than 10 MB."

        });
      }
    }

    res.status(500).json({

      success: false,

      error:
        error.message ||
        "Something went wrong."

    });
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,

  () => {

    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "      AI TEACHER ASSESSMENT"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server running at: http://localhost:${PORT}`
    );

    console.log(
      `Frontend: http://localhost:${PORT}`
    );

    console.log(
      `Status API: http://localhost:${PORT}/api/status`
    );

    console.log(
      `Model: ${MODEL_NAME}`
    );

    console.log(
      "======================================"
    );

    console.log("");

  }
);