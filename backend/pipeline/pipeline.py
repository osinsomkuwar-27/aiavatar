"""
pipeline.py — Shreeja's master orchestration server
Runs on port 8000. Osin's frontend calls POST /generate-video.

Full flow:
  Text → Translation (Bhargavi) → Emotion/SSML (Soham)
       → Voice (Kshitij) → Avatar Video (Tanishka) → Video URL
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import requests
import os
import uuid
import shutil
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Avatar Master Pipeline", version="1.0.0")

# Allow Osin's React frontend to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated videos as static files
os.makedirs("generated_videos", exist_ok=True)
app.mount("/videos", StaticFiles(directory="generated_videos"), name="videos")

# Service URLs
EMOTION_URL    = os.getenv("EMOTION_URL",    "http://localhost:8001")
TRANSLATION_URL= os.getenv("TRANSLATION_URL","http://localhost:8002")
VOICE_URL      = os.getenv("VOICE_URL",      "http://localhost:8003")
AVATAR_URL     = os.getenv("AVATAR_URL",     "http://localhost:8004")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/health")
def health():
    return {"status": "Pipeline running", "port": 8000}


@app.post("/generate-video")
async def generate_video(
    text: str = Form(...),
    target_language: str = Form(default="hi"),
    tone_override: str = Form(default=None),
    photo: UploadFile = File(...)
):
    """
    Main endpoint. Osin calls this.

    Input:
      - text          : the message to speak
      - target_language: language code e.g. 'hi', 'ta', 'te', 'mr'
      - tone_override : optional tone e.g. 'urgent', 'calm' (null = auto)
      - photo         : user's uploaded photo (JPG/PNG)

    Output:
      {
        "video_url": "http://localhost:8000/videos/xxxx.mp4",
        "detected_tone": "urgent",
        "translated_text": "...",
        "ssml": "<speak>...</speak>"
      }
    """

    session_id = uuid.uuid4().hex
    photo_path = os.path.join(UPLOAD_DIR, f"{session_id}_photo.png")

    try:
        # ── Save uploaded photo ──
        with open(photo_path, "wb") as f:
            f.write(await photo.read())

        print(f"\n[PIPELINE] Session: {session_id}")
        print(f"[PIPELINE] Text: {text}")
        print(f"[PIPELINE] Language: {target_language}")

        # ── STEP 1: Translate text (Bhargavi) ──
        print("[PIPELINE] Step 1: Translating...")
        try:
            trans_response = requests.post(
                f"{TRANSLATION_URL}/translate",
                json={"text": text, "target_language": target_language},
                timeout=30
            )
            translated_text = trans_response.json().get("translated_text", text)
        except Exception as e:
            print(f"[PIPELINE] Translation failed, using original: {e}")
            translated_text = text

        print(f"[PIPELINE] Translated: {translated_text}")

        # ── STEP 2: Emotion detection + SSML (Soham) ──
        print("[PIPELINE] Step 2: Detecting emotion and adding SSML...")
        emotion_response = requests.post(
            f"{EMOTION_URL}/enhance-text",
            json={
                "text": translated_text,
                "tone_override": tone_override if tone_override != "null" else None
            },
            timeout=30
        )

        if emotion_response.status_code != 200:
            raise HTTPException(status_code=500,
                detail=f"Emotion engine failed: {emotion_response.text}")

        emotion_data   = emotion_response.json()
        detected_tone  = emotion_data.get("detected_tone", "formal")
        ssml           = emotion_data.get("ssml", translated_text)

        print(f"[PIPELINE] Detected tone: {detected_tone}")

        # ── STEP 3: Generate voice audio (Kshitij) ──
        print("[PIPELINE] Step 3: Generating voice audio...")
        voice_response = requests.post(
            f"{VOICE_URL}/synthesize",
            json={"ssml": ssml, "detected_tone": detected_tone},
            timeout=60
        )

        if voice_response.status_code != 200:
            raise HTTPException(status_code=500,
                detail=f"Voice synthesis failed: {voice_response.text}")

        # Save audio
        audio_path = os.path.join(UPLOAD_DIR, f"{session_id}_audio.mp3")
        with open(audio_path, "wb") as f:
            f.write(voice_response.content)

        print(f"[PIPELINE] Audio saved: {audio_path}")

        # ── STEP 4: Generate avatar video (Tanishka → SadTalker) ──
        print("[PIPELINE] Step 4: Generating avatar video (2-3 min)...")
        with open(photo_path, "rb") as p, open(audio_path, "rb") as a:
            avatar_response = requests.post(
                f"{AVATAR_URL}/generate-avatar",
                files={
                    "photo": ("photo.png", p, "image/png"),
                    "audio": ("audio.mp3", a, "audio/mpeg")
                },
                timeout=300  # 5 min timeout for SadTalker
            )

        if avatar_response.status_code != 200:
            raise HTTPException(status_code=500,
                detail=f"Avatar generation failed: {avatar_response.text}")

        # Save final video
        video_filename = f"{session_id}_avatar.mp4"
        video_path = os.path.join("generated_videos", video_filename)
        with open(video_path, "wb") as f:
            f.write(avatar_response.content)

        video_url = f"http://localhost:8000/videos/{video_filename}"
        print(f"[PIPELINE] Done! Video: {video_url}")

        return JSONResponse({
            "success": True,
            "video_url": video_url,
            "detected_tone": detected_tone,
            "translated_text": translated_text,
            "ssml": ssml,
            "session_id": session_id
        })

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up upload files
        for f in [photo_path]:
            if os.path.exists(f):
                os.remove(f)


# Run with: uvicorn pipeline:app --reload --port 8000