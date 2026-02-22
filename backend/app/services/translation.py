import httpx
from urllib.parse import quote
from app.config import settings

SUPPORTED_LANGS = {"fr", "en", "nl", "de"}


async def translate_text(text: str, source: str, target: str) -> str:
    """Translate text using configured backend (LibreTranslate or MyMemory)."""
    if not text or not text.strip():
        return ""

    backend = settings.TRANSLATION_BACKEND

    async with httpx.AsyncClient(timeout=30.0) as client:
        if backend == "mymemory":
            resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text, "langpair": f"{source}|{target}"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("responseStatus") != 200:
                raise Exception(f"MyMemory error: {data.get('responseDetails')}")
            return data["responseData"]["translatedText"]
        elif backend == "lingva":
            encoded = quote(text)
            resp = await client.get(
                f"https://lingva.ml/api/v1/{source}/{target}/{encoded}",
            )
            resp.raise_for_status()
            return resp.json()["translation"]
        else:
            # Default: LibreTranslate (local Docker or self-hosted)
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
