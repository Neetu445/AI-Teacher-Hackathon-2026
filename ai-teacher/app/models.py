from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    doc_id: str | None = None
    topic: str | None = None
    section: str | None = None
    level: str = "beginner"            # beginner | intermediate | advanced
    language: str = "en"               # en | hi | hinglish | (any, when LLM enabled)
    minutes: int = 20
    style: str = "conceptual"          # conceptual | exam | interview | story
    persona: str = "priya"             # priya (warm) | prof (formal)
    student_name: str | None = None
    grade: str | None = None           # e.g. "Class 5"
    subject: str | None = None         # e.g. "Science"


class AnswerRequest(BaseModel):
    answer: str = Field(min_length=1)


class DoubtRequest(BaseModel):
    question: str = Field(min_length=2)


class LanguageRequest(BaseModel):
    language: str
