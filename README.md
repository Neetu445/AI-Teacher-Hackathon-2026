AI-TEACH — AI GURU
AI Teacher Hackathon 2026
## Project Documentation & Demonstration Guide

## 1. Project Overview
AI-TEACH (AI Guru) is an adaptive AI teaching platform designed to provide personalized learning instead of giving every student the same explanation. The system evaluates student responses, identifies areas of difficulty, adapts its teaching strategy, re-teaches concepts using a different explanation or analogy, and validates improvement through a fresh question.

## 2. Core Learning Loop
Understand → Explain → Assess → Detect Difficulty → Adapt → Re-teach → Re-test → Track Progress
The key innovation is that the system does not only identify that a student is wrong; it changes how it teaches based on the student's learning response.

## 3. Key Features
Personalized AI teaching based on learner level, topic and preferences.
Adaptive explanations when the student struggles.
Assessment and answer evaluation.
Weak-concept and misconception detection.
Re-teaching using alternative explanations or analogies.
Fresh validation questions after re-teaching.
Learning progress and report generation.
Topic-based learning and learning-material upload.
RAG/knowledge grounding using TF-IDF retrieval.
English, Hindi and Hinglish support.
Animated AI teacher/avatar and visual classroom.
Voice interaction using browser speech capabilities.
Browser-based lesson recording.
 
 ## 4. Technology Stack
Area
Technology
Backend
Python, FastAPI
Frontend
HTML, CSS, JavaScript
AI
Adaptive tutoring logic + optional OpenAI-compatible LLM
RAG
TF-IDF based retrieval
Document Processing
PDF, DOCX, PPTX, TXT/Markdown
Speech
Browser Speech APIs / optional TTS
Deployment
Docker / Render-compatible configuration

## 5. System Architecture
Student → FastAPI API → Material Ingestion / RAG / Lesson Planner → Adaptive Tutor Session → Explain → Question → Evaluate → Adapt or Extend → Re-test → Progress / Report


## 6. Adaptive Teaching Flow
Student begins a lesson.
AI teacher explains the selected concept.
The system asks a question.
Student submits an answer.
The answer is evaluated.
If correct, the lesson can continue or extend the concept.
If incorrect, the system identifies the likely difficulty or misconception.
The teacher provides targeted feedback and changes the explanation strategy.
A fresh validation question is presented.
The new result updates the learner's mastery/progress state.
The session can finish with a learning report.

## 7. RAG / Learning Material Flow
Upload Material → Extract Text → Create Chunks → Build TF-IDF Index → Retrieve Relevant Content → Ground Lesson, Questions and Doubt Answers
The current implementation uses lightweight in-memory TF-IDF retrieval so the project can run without requiring an external vector database.

## 8. Project Structure
AI_TEACH-2026/
└── ai-teacher/
    ├── app/
    │   ├── main.py
    │   ├── tutor.py
    │   ├── pedagogy.py
    │   ├── rag.py
    │   ├── ingest.py
    │   ├── profile.py
    │   ├── models.py
    │   ├── llm.py
    │   ├── tts.py
    │   └── config.py
    ├── web/
    │   ├── index.html
    │   ├── css/style.css
    │   └── js/
    │       ├── app.js
    │       ├── avatar.js
    │       ├── whiteboard.js
    │       ├── i18n.js
    │       ├── speech.js
    │       └── recorder.js
    ├── data/
    ├── samples/
    ├── docs/
    ├── scripts/
    ├── requirements.txt
    ├── Dockerfile
    ├── Procfile
    ├── render.yaml
    └── README.md
## 9. How to Run
1. Clone the repository:
git clone https://github.com/Neetu445/AI-Teacher-Hackathon-2026.git
2. Enter the application folder:
cd AI-Teacher-Hackathon-2026/ai-teacher
3. Install dependencies:
pip install -r requirements.txt
4. Start the server:
uvicorn app.main:app --reload --port 8000
5. Open in a browser:
http://localhost:8000


## 10. Environment Configuration
Optional AI configuration can be supplied through a .env file:
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
AI_TEACHER_MODEL=gpt-4o-mini
AI_TEACHER_TTS=none
Never commit a real API key to GitHub.


## 11. Recommended Hackathon Demonstration
Open the AI-TEACH classroom.
Select a simple topic such as Plants or Ohm's Law.
Select the learner level and preferred language.
Start the lesson and show the AI teacher explaining the concept.
When a question appears, intentionally provide an incorrect answer.
Show the evaluation/difficulty response.
Show the teacher changing its explanation or using another analogy.
Answer the fresh validation question correctly.
Show the updated learning progress/report.
Optionally demonstrate Hindi/English switching and material upload.
12. Strongest Demo Moment
Wrong Answer → Difficulty/Misconception → Adaptive Explanation → Fresh Question → Correct Answer → Improvement
This sequence should be the center of the video because it demonstrates the difference between a normal chatbot and an adaptive teacher.
13. API Overview
Method
Endpoint
Purpose
GET
/api/config
App capabilities, languages and personas
POST
/api/upload
Upload and parse learning material
GET
/api/docs/{id}
Get document information
POST
/api/sessions
Start a learning session
POST
/api/sessions/{id}/next
Get the next teaching step
POST
/api/sessions/{id}/answer
Submit/evaluate an answer
POST
/api/sessions/{id}/ask
Ask a learning doubt
POST
/api/sessions/{id}/language
Change teaching language
GET
/api/sessions/{id}
Get session state
GET
/api/sessions/{id}/report
Generate learning report
GET
/api/profile
Get learner profile/mastery

 ## 14. Privacy & Real-World Considerations
The prototype uses local learner-profile persistence. For production deployment, student data should be protected with authentication, authorization, encryption, appropriate consent and privacy controls. Sensitive student information should not be used in a public demo environment.


## 15. Future Scope
Embedding-based RAG and vector databases.
Larger curriculum and content libraries.
Teacher and administrator dashboards.
Multi-student classroom analytics.
Knowledge-tracing and stronger learner models.
Improved speech and multimodal learning analysis.
Mobile applications and LMS integration.
Privacy-preserving analytics.

## 17. Repository & Demo##
GitHub: https://github.com/Neetu445/AI-Teacher-Hackathon-2026
Demo Video: AI-TEACH Hackathon Demonstration — 2026

## 18. One-Line Pitch##
AI-TEACH doesn't just give students answers — it adapts its teaching until the student understands.
