"""Optional server-side TTS.

Default ('none') means the browser speaks with the Web Speech API
(free, multilingual, incl. Hindi voices). Optionally set AI_TEACHER_TTS=gtts
or =edge to synthesize mp3 on the server (pip install gTTS / edge-tts).
"""
import io

from . import config

_LANG_MAP = {"en": "en", "hi": "hi", "hinglish": "hi", "mr": "mr", "ta": "ta", "te": "te",
             "bn": "bn", "gu": "gu", "kn": "kn", "pa": "pa", "es": "es", "fr": "fr", "de": "de"}


def available():
    if config.TTS_PROVIDER == "gtts":
        try:
            import gtts  # noqa: F401
            return True
        except ImportError:
            return False
    if config.TTS_PROVIDER == "edge":
        try:
            import edge_tts  # noqa: F401
            return True
        except ImportError:
            return False
    return False


def synthesize(text, language="en"):
    """Return (audio_bytes, mime) or None."""
    lang = _LANG_MAP.get(language, "en")
    if config.TTS_PROVIDER == "gtts":
        try:
            from gtts import gTTS
            buf = io.BytesIO()
            gTTS(text=text, lang=lang).write_to_fp(buf)
            return buf.getvalue(), "audio/mpeg"
        except Exception:
            return None
    if config.TTS_PROVIDER == "edge":
        try:
            import asyncio
            import edge_tts
            voice = "hi-IN-SwaraNeural" if lang == "hi" else "en-IN-NeerjaNeural"

            async def _run():
                buf = b""
                async for chunk in edge_tts.Communicate(text, voice).stream():
                    if chunk["type"] == "audio":
                        buf += chunk["data"]
                return buf

            data = asyncio.run(_run())
            return data, "audio/mpeg" if data else (None, None)
        except Exception:
            return None
    return None, None
