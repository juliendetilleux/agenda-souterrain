import httpx
from app.config import settings

SUPPORTED_LANGS = {"fr", "en", "nl", "de"}


async def translate_text(text: str, source: str, target: str) -> str:
    """Translate text using LibreTranslate."""
    if not text or not text.strip():
        return ""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.LIBRETRANSLATE_URL}/translate",
            json={
                "q": text,
                "source": source,
                "target": target,
                "format": "text",
            },
        )
        resp.raise_for_status()
        return resp.json()["translatedText"]
