"""Pluggable LLM layer.

Uses only the Python standard library (urllib) so the backend has no heavy
HTTP dependencies. Works with any OpenAI-compatible chat-completions API
(OpenAI, OpenRouter, Azure w/ compatible proxy, vLLM, Ollama, LM Studio...).

Every function degrades gracefully: if no key is configured or the call
fails, it returns None and the caller falls back to the built-in offline
pedagogy engine, so the product always works.
"""
import json
import urllib.request
import urllib.error

from . import config


def chat(messages, temperature=0.4, max_tokens=1800, json_mode=False, timeout=60):
    """Return assistant message content (str) or None on any failure."""
    if not config.LLM_ENABLED:
        return None
    payload = {
        "model": config.MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        config.OPENAI_BASE_URL + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.OPENAI_API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError, TimeoutError):
        return None


def chat_json(messages, temperature=0.3, max_tokens=2200):
    """Ask the model for JSON. Returns parsed dict/list or None.

    Tries strict JSON mode first, then plain mode with brace-extraction,
    so it also works with endpoints that reject response_format.
    """
    out = chat(messages, temperature=temperature, max_tokens=max_tokens, json_mode=True)
    parsed = _extract_json(out)
    if parsed is not None:
        return parsed
    out = chat(messages, temperature=temperature, max_tokens=max_tokens, json_mode=False)
    return _extract_json(out)


def _extract_json(text):
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        # strip code fences
        lines = [l for l in text.splitlines() if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except ValueError:
            return None
    return None


def is_available():
    return config.LLM_ENABLED
