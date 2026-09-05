#!/usr/bin/env bash
# AI Guru — one-command setup & launch
set -e
cd "$(dirname "$0")"

python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate 2>/dev/null || true
pip install -q -r requirements.txt

# Optional: connect any OpenAI-compatible LLM for full dynamic lesson generation
# export OPENAI_API_KEY=sk-...
# export OPENAI_BASE_URL=https://openrouter.ai/api/v1   # or Ollama, vLLM, Azure...
# export AI_TEACHER_MODEL=gpt-4o-mini
# Optional: neural voices
# pip install edge-tts && export AI_TEACHER_TTS=edge

PORT="${PORT:-8000}"
echo "🎓 AI Guru running at http://localhost:$PORT"
python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
