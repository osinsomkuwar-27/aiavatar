from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import os
import io
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

app = FastAPI(title="Voice Synthesis API", version="1.0.0")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")


class VoiceRequest(BaseModel):
    ssml: str
    detected_tone: str = "formal"


@app.get("/health")
def health():
    return {"status": "Voice Synthesis API running", "port": 8003}


@app.post("/synthesize")
def synthesize(request: VoiceRequest):
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        raise HTTPException(status_code=500, detail="ElevenLabs API key or Voice ID not set in .env")

    # Map tone to ElevenLabs voice settings
    tone_settings = {
        "urgent":    {"stability": 0.3, "similarity_boost": 0.8, "style": 0.8},
        "calm":      {"stability": 0.9, "similarity_boost": 0.7, "style": 0.2},
        "inspiring": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.7},
        "formal":    {"stability": 0.8, "similarity_boost": 0.7, "style": 0.1},
        "empathetic":{"stability": 0.7, "similarity_boost": 0.8, "style": 0.5},
    }

    settings = tone_settings.get(request.detected_tone, tone_settings["formal"])

    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "text": request.ssml,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": settings
        }
    )

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"ElevenLabs error: {response.text}")

    return StreamingResponse(
        io.BytesIO(response.content),
        media_type="audio/mpeg"
    )

# Run with: uvicorn voice_synthesis:app --reload --port 8003