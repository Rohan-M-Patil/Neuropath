import json
import re
from groq import Groq
from app.config import settings

MODEL = "llama-3.3-70b-versatile"

_client = None


def _get_client() -> Groq:
    """Lazily construct the Groq client so import-time version conflicts
    (e.g. groq/httpx 'proxies' kwarg mismatch) don't crash the whole app
    at startup — they only surface when an LLM call is actually made,
    with a clearer error."""
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def call_llm(system_prompt: str, user_prompt: str, json_mode: bool = True, temperature: float = 0.3, max_tokens: int = 4096) -> str:
    """Call Groq Llama 3.3 70B. Returns raw text content."""
    kwargs = dict(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    resp = _get_client().chat.completions.create(**kwargs)
    return resp.choices[0].message.content


def call_llm_json(system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 4096) -> dict:
    """Call LLM and parse JSON response, stripping markdown fences if present."""
    raw = call_llm(system_prompt, user_prompt, json_mode=True, temperature=temperature, max_tokens=max_tokens)
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # last-resort: find first { ... last }
        start, end = cleaned.find("{"), cleaned.rfind("}")
        return json.loads(cleaned[start:end + 1])
