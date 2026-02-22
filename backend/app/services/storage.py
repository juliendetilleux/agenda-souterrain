"""
Abstraction de stockage de fichiers.
- LocalStorage : écrit dans UPLOAD_DIR (mode dev / Docker)
- R2Storage : écrit dans Cloudflare R2 via API S3-compatible (production)

Sélection via STORAGE_BACKEND env var ("local" ou "r2").
"""

import os
from abc import ABC, abstractmethod
from app.config import settings


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, filename: str, data: bytes) -> None: ...

    @abstractmethod
    async def delete(self, filename: str) -> None: ...

    @abstractmethod
    def url(self, filename: str) -> str: ...


class LocalStorage(StorageBackend):
    async def save(self, filename: str, data: bytes) -> None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(path, "wb") as f:
            f.write(data)

    async def delete(self, filename: str) -> None:
        path = os.path.join(settings.UPLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)

    def url(self, filename: str) -> str:
        return f"/v1/uploads/{filename}"


class R2Storage(StorageBackend):
    def __init__(self):
        import boto3
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET_KEY,
            region_name="auto",
        )
        self._bucket = settings.R2_BUCKET

    async def save(self, filename: str, data: bytes) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=filename,
            Body=data,
        )

    async def delete(self, filename: str) -> None:
        self._client.delete_object(
            Bucket=self._bucket,
            Key=filename,
        )

    def url(self, filename: str) -> str:
        if settings.R2_PUBLIC_URL:
            return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{filename}"
        return f"/v1/uploads/{filename}"


def get_storage() -> StorageBackend:
    if settings.STORAGE_BACKEND == "r2":
        return R2Storage()
    return LocalStorage()


storage = get_storage()
