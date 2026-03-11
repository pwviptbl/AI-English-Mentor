from collections.abc import Iterable

from app.core.config import settings

DEFAULT_EDGE_TTS_VOICE = settings.edge_tts_default_voice
SUPPORTED_EDGE_TTS_VOICES = (
    "en-US-AriaNeural",
    "en-US-DavisNeural",
    "en-US-GuyNeural",
    "en-US-JennyNeural",
    "en-GB-RyanNeural",
    "en-GB-SoniaNeural",
    "en-AU-NatashaNeural",
    "en-AU-WilliamNeural",
)


def list_supported_edge_tts_voices() -> Iterable[str]:
    return SUPPORTED_EDGE_TTS_VOICES


def is_supported_edge_tts_voice(voice: str) -> bool:
    return voice in SUPPORTED_EDGE_TTS_VOICES


def normalize_edge_tts_rate(rate: float) -> str:
    clamped = min(max(rate, 0.5), 1.5)
    percent = int(round((clamped - 1.0) * 100))
    sign = "+" if percent >= 0 else ""
    return f"{sign}{percent}%"


async def synthesize_with_edge_tts(text: str, voice: str, rate: float) -> bytes:
    import edge_tts

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=normalize_edge_tts_rate(rate),
    )
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)