from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import shutil
import uuid
from avatar import generate_avatar_video

app = FastAPI(title="Avatar Video API", version="1.0.0")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/health")
def health():
    return {"status": "Avatar Video API running", "port": 8004}


@app.post("/generate-avatar")
async def generate_avatar(
    photo: UploadFile = File(...),
    audio: UploadFile = File(...)
):
    """
    Input:  photo file (JPG/PNG) + audio file (MP3/WAV)
    Output: MP4 video of the person speaking

    Called by Shreeja's pipeline.py
    """
    session_id = uuid.uuid4().hex
    photo_path = os.path.join(UPLOAD_DIR, f"{session_id}_photo.png")
    audio_path = os.path.join(UPLOAD_DIR, f"{session_id}_audio.mp3")

    try:
        # Save uploaded files
        with open(photo_path, "wb") as f:
            f.write(await photo.read())

        with open(audio_path, "wb") as f:
            f.write(await audio.read())

        print(f"[AVATAR API] Photo: {photo_path}")
        print(f"[AVATAR API] Audio: {audio_path}")

        # Generate video
        video_path = generate_avatar_video(photo_path, audio_path)

        if not os.path.exists(video_path):
            raise HTTPException(status_code=500, detail="Video generation failed")

        return FileResponse(
            video_path,
            media_type="video/mp4",
            filename="avatar_video.mp4"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up uploads
        for f in [photo_path, audio_path]:
            if os.path.exists(f):
                os.remove(f)


# Run with: uvicorn main:app --reload --port 8004