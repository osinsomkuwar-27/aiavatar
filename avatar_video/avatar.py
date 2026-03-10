import requests
import os
import shutil
import subprocess
import glob
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

SADTALKER_URL = os.getenv("SADTALKER_URL")  # ngrok URL from Colab
USE_LOCAL = os.getenv("USE_LOCAL_SADTALKER", "false").lower() == "true"
SADTALKER_DIR = os.path.join(os.path.dirname(__file__), "SadTalker")


# ─────────────────────────────────────────
# OPTION A — Call SadTalker on Colab via ngrok
# (USE THIS FOR HACKATHON)
# ─────────────────────────────────────────
def generate_avatar_via_api(photo_path: str, audio_path: str) -> str:
    """
    Sends photo + audio to SadTalker running on Google Colab.
    Returns path to downloaded video file.

    Requirements:
    - Colab must be open and running the Flask+ngrok cell
    - SADTALKER_URL must be set in .env
    """
    if not SADTALKER_URL:
        raise Exception("SADTALKER_URL not set in .env — start Colab and get the ngrok URL")

    print(f"[AVATAR] Sending to SadTalker API: {SADTALKER_URL}")

    with open(photo_path, 'rb') as photo, open(audio_path, 'rb') as audio:
        response = requests.post(
            f"{SADTALKER_URL}/generate",
            files={
                'photo': ('photo.png', photo, 'image/png'),
                'audio': ('audio.mp3', audio, 'audio/mpeg')
            },
            timeout=300  # 5 min — SadTalker takes 2-3 min
        )

    if response.status_code != 200:
        raise Exception(f"SadTalker API failed [{response.status_code}]: {response.text}")

    # Save video locally
    os.makedirs(os.path.join(os.path.dirname(__file__), "outputs"), exist_ok=True)
    output_path = os.path.join(os.path.dirname(__file__), "outputs", "avatar_video.mp4")

    with open(output_path, 'wb') as f:
        f.write(response.content)

    print(f"[AVATAR] Video saved: {output_path}")
    return output_path


# ─────────────────────────────────────────
# OPTION B — Run SadTalker locally
# (USE THIS IF SADTALKER IS INSTALLED ON THIS MACHINE)
# ─────────────────────────────────────────
def generate_avatar_local(photo_path: str, audio_path: str) -> str:
    """
    Runs SadTalker directly on this machine.
    Requires SadTalker to be installed in avatar_video/SadTalker/

    Run setup.py first to install SadTalker locally.
    """
    results_dir = os.path.join(SADTALKER_DIR, "results")

    # Clear old results
    if os.path.exists(results_dir):
        shutil.rmtree(results_dir)
    os.makedirs(results_dir, exist_ok=True)

    # Copy inputs into SadTalker folder (avoids space-in-filename issues)
    shutil.copy(photo_path, os.path.join(SADTALKER_DIR, "input_photo.png"))

    # Convert audio to WAV
    subprocess.run([
        "ffmpeg", "-y", "-i", audio_path,
        os.path.join(SADTALKER_DIR, "input_audio.wav")
    ], capture_output=True)

    print("[AVATAR] Running SadTalker locally... (2-3 minutes)")

    result = subprocess.run([
        "python", "inference.py",
        "--driven_audio", "./input_audio.wav",
        "--source_image", "./input_photo.png",
        "--result_dir", "./results",
        "--still",
        "--preprocess", "full",
        "--enhancer", "gfpgan"
    ], capture_output=True, text=True, cwd=SADTALKER_DIR)

    if result.returncode != 0:
        raise Exception(f"SadTalker failed: {result.stderr[-1000:]}")

    # Find final video
    mp4_files = glob.glob(os.path.join(results_dir, "**", "*.mp4"), recursive=True)
    if not mp4_files:
        raise Exception("SadTalker ran but no video was generated")

    final_video = min(mp4_files, key=lambda x: len(x))

    # Copy to outputs folder
    os.makedirs(os.path.join(os.path.dirname(__file__), "outputs"), exist_ok=True)
    output_path = os.path.join(os.path.dirname(__file__), "outputs", "avatar_video.mp4")
    shutil.copy(final_video, output_path)

    print(f"[AVATAR] Video ready: {output_path}")
    return output_path


# ─────────────────────────────────────────
# MAIN FUNCTION — Shreeja calls this
# ─────────────────────────────────────────
def generate_avatar_video(photo_path: str, audio_path: str) -> str:
    """
    Main function. Shreeja calls this from pipeline.py.

    Input:  photo_path — path to user's uploaded photo
            audio_path — path to MP3 from Kshitij's ElevenLabs
    Output: path to generated .mp4 video
    """
    if USE_LOCAL:
        return generate_avatar_local(photo_path, audio_path)
    else:
        return generate_avatar_via_api(photo_path, audio_path)


# ─────────────────────────────────────────
# QUICK TEST
# ─────────────────────────────────────────
if __name__ == "__main__":
    import sys

    photo = sys.argv[1] if len(sys.argv) > 1 else "test_photo.jpg"
    audio = sys.argv[2] if len(sys.argv) > 2 else "test_audio.mp3"

    if not os.path.exists(photo):
        print(f"ERROR: Photo not found at '{photo}'")
        print("Usage: python avatar.py your_photo.jpg your_audio.mp3")
        sys.exit(1)

    if not os.path.exists(audio):
        print(f"ERROR: Audio not found at '{audio}'")
        sys.exit(1)

    print("Testing avatar generation...")
    result = generate_avatar_video(photo, audio)
    print(f"\nSUCCESS! Video at: {result}")