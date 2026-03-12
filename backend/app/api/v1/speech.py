from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.api.deps import get_current_user
from app.db.models import User
from app.schemas.speech import SpeechSynthesizeRequest
from app.services.edge_tts import DEFAULT_EDGE_TTS_VOICE, is_supported_edge_tts_voice, synthesize_with_edge_tts

router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/tts")
async def synthesize_speech(
    payload: SpeechSynthesizeRequest,
    current_user: User = Depends(get_current_user),
) -> Response:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    voice = (current_user.edge_tts_voice or DEFAULT_EDGE_TTS_VOICE).strip()
    if not is_supported_edge_tts_voice(voice):
        voice = DEFAULT_EDGE_TTS_VOICE

    try:
        audio = await synthesize_with_edge_tts(text=text, voice=voice, rate=payload.rate)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"edge tts unavailable: {exc}") from exc

    if not audio:
        raise HTTPException(status_code=502, detail="edge tts returned empty audio")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'inline; filename="speech.mp3"'},
    )