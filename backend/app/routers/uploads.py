import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from app.config import settings
from app.services.storage import storage

router = APIRouter(tags=["uploads"])


@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files. No auth required — files are accessed by UUID filename."""
    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=403, detail="Acces refuse")

    # In R2 mode with public URL, redirect to the R2 URL
    if settings.STORAGE_BACKEND == "r2" and settings.R2_PUBLIC_URL:
        return RedirectResponse(
            url=f"{settings.R2_PUBLIC_URL.rstrip('/')}/{filename}",
            status_code=302,
        )

    # Local mode: serve from filesystem
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    real_path = os.path.realpath(file_path)
    real_upload = os.path.realpath(settings.UPLOAD_DIR)
    if not real_path.startswith(real_upload):
        raise HTTPException(status_code=403, detail="Acces refuse")

    return FileResponse(real_path)
