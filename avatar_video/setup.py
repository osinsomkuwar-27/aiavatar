"""
setup.py — Run this once to install SadTalker on this machine.
Usage: python setup.py

This clones SadTalker, installs all dependencies,
downloads model weights, and applies all compatibility fixes.
"""

import os
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent
SADTALKER_DIR = BASE / "SadTalker"


def run(cmd, **kwargs):
    print(f"  >> {' '.join(cmd)}")
    result = subprocess.run(cmd, **kwargs)
    return result


def step1_clone():
    print("\n[1/5] Cloning SadTalker...")
    if SADTALKER_DIR.exists():
        print("  Already cloned, skipping.")
        return
    run(["git", "clone", "https://github.com/OpenTalker/SadTalker.git",
         str(SADTALKER_DIR)], check=True)
    print("  Done!")


def step2_install_packages():
    print("\n[2/5] Installing packages...")
    pip = [sys.executable, "-m", "pip", "install"]

    run(pip + ["numpy==1.26.4", "-q"])
    run(pip + [
        "torch==2.0.1", "torchvision==0.15.2", "torchaudio==2.0.2",
        "--index-url", "https://download.pytorch.org/whl/cu118", "-q"
    ])

    packages = [
        "yacs", "kornia", "einops", "safetensors",
        "imageio==2.19.3", "imageio-ffmpeg",
        "librosa==0.9.2", "resampy", "pydub",
        "scipy", "scikit-image",
        "basicsr==1.4.2", "facexlib", "gfpgan",
        "face_alignment", "dlib", "tqdm", "pyyaml",
        "gdown", "requests", "python-dotenv",
        "fastapi", "uvicorn", "python-multipart"
    ]

    for pkg in packages:
        run(pip + [pkg, "-q"])

    print("  Done!")


def step3_download_weights():
    print("\n[3/5] Downloading model weights...")
    checkpoints = SADTALKER_DIR / "checkpoints"
    gfpgan_weights = SADTALKER_DIR / "gfpgan" / "weights"
    checkpoints.mkdir(exist_ok=True)
    gfpgan_weights.mkdir(parents=True, exist_ok=True)

    result = run(
        [sys.executable, "scripts/download_models.py"],
        cwd=str(SADTALKER_DIR)
    )

    if result.returncode != 0:
        print("  Auto-download failed. Please manually download from:")
        print("  https://github.com/OpenTalker/SadTalker#-2-download-trained-models")
    else:
        print("  Done!")


def step4_apply_fixes():
    print("\n[4/5] Applying compatibility fixes...")

    # Fix 1 — VisibleDeprecationWarning (NumPy 2.0)
    f1 = SADTALKER_DIR / "src/face3d/util/preprocess.py"
    if f1.exists():
        content = f1.read_text()
        content = content.replace(
            'warnings.filterwarnings("ignore", category=np.VisibleDeprecationWarning)',
            'warnings.filterwarnings("ignore")'
        )
        # Fix inhomogeneous array
        content = content.replace(
            "trans_params = np.array([w0, h0, s, t[0], t[1]])",
            "trans_params = np.array([w0, h0, s, float(t[0]), float(t[1])])"
        )
        f1.write_text(content)
        print("  Fixed: preprocess.py")

    # Fix 2 — np.float deprecated
    f2 = SADTALKER_DIR / "src/face3d/util/my_awing_arch.py"
    if f2.exists():
        content = f2.read_text()
        for old, new in [("np.float,", "float,"), ("np.float(", "float("), ("np.float ", "float ")]:
            content = content.replace(old, new)
        f2.write_text(content)
        print("  Fixed: my_awing_arch.py")

    # Fix 3 — basicsr torchvision import
    result = subprocess.run(
        ["find", str(SADTALKER_DIR), "-name", "degradations.py"],
        capture_output=True, text=True
    )
    for fp in result.stdout.strip().split("\n"):
        if fp:
            p = Path(fp)
            content = p.read_text()
            content = content.replace(
                "from torchvision.transforms.functional_tensor import rgb_to_grayscale",
                "from torchvision.transforms.functional import rgb_to_grayscale"
            )
            p.write_text(content)
            print(f"  Fixed: {p.name}")

    # Fix 4 — seamlessClone boundary error
    f4 = SADTALKER_DIR / "src/utils/paste_pic.py"
    if f4.exists():
        content = f4.read_text()
        old = "        mask = 255*np.ones(p.shape, p.dtype)\n        location = ((ox1+ox2) // 2, (oy1+oy2) // 2)\n        gen_img = cv2.seamlessClone(p, full_img, mask, location, cv2.NORMAL_CLONE)\n        out_tmp.write(gen_img)"
        new = """        mask = 255*np.ones(p.shape, p.dtype)
        location = ((ox1+ox2) // 2, (oy1+oy2) // 2)
        h_full, w_full = full_img.shape[:2]
        h_p, w_p = p.shape[:2]
        cx, cy = location
        cx = int(np.clip(cx, w_p//2 + 1, w_full - w_p//2 - 1))
        cy = int(np.clip(cy, h_p//2 + 1, h_full - h_p//2 - 1))
        location = (cx, cy)
        try:
            gen_img = cv2.seamlessClone(p, full_img, mask, location, cv2.NORMAL_CLONE)
        except cv2.error:
            gen_img = full_img.copy()
            x1 = max(0, cx - w_p//2)
            y1 = max(0, cy - h_p//2)
            x2 = min(w_full, x1 + w_p)
            y2 = min(h_full, y1 + h_p)
            gen_img[y1:y2, x1:x2] = p[:y2-y1, :x2-x1]
        out_tmp.write(gen_img)"""
        if old in content:
            content = content.replace(old, new)
            f4.write_text(content)
            print("  Fixed: paste_pic.py")

    print("  All fixes applied!")


def step5_create_folders():
    print("\n[5/5] Creating project folders...")
    for folder in ["inputs/photos", "inputs/audio", "outputs/videos", "uploads"]:
        (BASE / folder).mkdir(parents=True, exist_ok=True)
    print("  Done!")


if __name__ == "__main__":
    print("=" * 50)
    print("  SadTalker Setup for AI Avatar Platform")
    print("=" * 50)

    step1_clone()
    step2_install_packages()
    step3_download_weights()
    step4_apply_fixes()
    step5_create_folders()

    print("\n" + "=" * 50)
    print("  SETUP COMPLETE!")
    print("  Test it: python avatar.py test_photo.jpg test_audio.mp3")
    print("  Run server: uvicorn main:app --reload --port 8004")
    print("=" * 50)