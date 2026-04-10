import os
import uuid
import aiofiles
from pathlib import Path
from PIL import Image
from fastapi import UploadFile
from app.config import settings

# Instagram requirements
IG_IMAGE_MIN_WIDTH = 320
IG_IMAGE_MAX_WIDTH = 1440
IG_MAX_FILE_SIZE_MB = 8


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}


def _generate_filename(original: str) -> str:
    ext = Path(original).suffix.lower()
    return f"{uuid.uuid4().hex}{ext}"


async def save_upload_file(upload_file: UploadFile) -> dict:
    """Save uploaded file to disk, process if image."""
    content_type = upload_file.content_type or ""

    if content_type not in ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES:
        raise ValueError(f"Unsupported file type: {content_type}")

    filename = _generate_filename(upload_file.filename or "file")
    file_path = Path(settings.MEDIA_DIR) / filename

    # Save raw file
    async with aiofiles.open(file_path, "wb") as f:
        content = await upload_file.read()
        await f.write(content)

    file_size = os.path.getsize(file_path)
    media_type = "image" if content_type in ALLOWED_IMAGE_TYPES else "video"

    # Process image for Instagram compliance
    if media_type == "image":
        file_path = _process_image(file_path)

    return {
        "file_name": filename,
        "file_path": str(file_path),
        "media_type": media_type,
        "mime_type": content_type,
        "file_size": file_size,
    }


def _process_image(file_path: Path) -> Path:
    """
    Resize/convert image to meet Instagram requirements.
    - Convert PNG/WEBP to JPEG
    - Resize if too large or too small
    """
    img = Image.open(file_path)

    # Convert to RGB (Instagram requires JPEG)
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize if needed
    width, height = img.size
    if width > IG_IMAGE_MAX_WIDTH:
        ratio = IG_IMAGE_MAX_WIDTH / width
        new_size = (IG_IMAGE_MAX_WIDTH, int(height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    elif width < IG_IMAGE_MIN_WIDTH:
        ratio = IG_IMAGE_MIN_WIDTH / width
        new_size = (IG_IMAGE_MIN_WIDTH, int(height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Save as JPEG
    jpeg_path = file_path.with_suffix(".jpg")
    img.save(jpeg_path, "JPEG", quality=95, optimize=True)

    # Remove original if different
    if jpeg_path != file_path:
        file_path.unlink(missing_ok=True)

    return jpeg_path


def delete_media_file(file_path: str):
    path = Path(file_path)
    if path.exists():
        path.unlink()