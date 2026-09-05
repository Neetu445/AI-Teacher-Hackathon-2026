"""Configuration for the AI Teacher backend.

Environment variables (all optional):
    OPENAI_API_KEY      - API key for any OpenAI-compatible endpoint (OpenAI, OpenRouter, Azure, local vLLM, Ollama etc.)
    OPENAI_BASE_URL     - base URL of the endpoint (default https://api.openai.com/v1)
    AI_TEACHER_MODEL    - model name (default gpt-4o-mini)
    AI_TEACHER_TTS      - server TTS provider: none (default) | gtts | edge
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
PROFILE_PATH = os.path.join(DATA_DIR, "profile.json")
WEB_DIR = os.path.join(BASE_DIR, "web")

for _d in (DATA_DIR, UPLOAD_DIR):
    os.makedirs(_d, exist_ok=True)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
MODEL = os.environ.get("AI_TEACHER_MODEL", "gpt-4o-mini")
LLM_ENABLED = bool(OPENAI_API_KEY)

TTS_PROVIDER = os.environ.get("AI_TEACHER_TTS", "none")

APP_NAME = "AI Guru"
APP_TAGLINE = "A teacher, not a chatbot."
