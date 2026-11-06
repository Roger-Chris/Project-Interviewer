import json
import re
import asyncio
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

class AIService:
    """
    Low-level client for interacting with LM Studio's OpenAI compatible API.
    Handles pings, model listings, raw prompt posting, exponential retries,
    timeouts, and robust JSON parsing/extraction.
    """

    # Keys loaded from .env via settings — never hardcode secrets in source
    GEMINI_KEYS = settings.GEMINI_API_KEYS
    current_key_index = 0

    @classmethod
    async def get_loaded_models(cls) -> List[str]:
        """
        Queries LM Studio's /v1/models endpoint to identify currently active models.
        """
        url = f"{settings.LM_STUDIO_BASE_URL}/models"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    return models
        except Exception as err:
            print(f"[Warning] Failed to fetch loaded models from {url}: {err}")
        return []

    @classmethod
    async def post_prompt(
        cls, 
        model: str, 
        system_instruction: str, 
        user_prompt: str, 
        response_format: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
        backoff_factor: float = 2.0,
        max_tokens: int = 4096,
        provider: str = "local"
    ) -> str:
        """
        Posts system and user prompt commands to the chat/completions endpoint (or Gemini API).
        Implements linear-to-exponential backoff retries on connectivity or timeout events.
        """
        if provider == "gemini":
            print(f"[Debug Gemini Request] System: {len(system_instruction)} chars, User: {len(user_prompt)} chars, MaxTokens: {max_tokens}", flush=True)
            last_exception = None
            for attempt in range(1, len(cls.GEMINI_KEYS) + 1):
                key = cls.GEMINI_KEYS[cls.current_key_index]
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}"
                payload = {
                    "systemInstruction": {
                        "parts": [{"text": system_instruction}]
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": user_prompt}]
                        }
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2,
                        "maxOutputTokens": max_tokens
                    }
                }
                try:
                    timeout = max(300.0, float(settings.REQUEST_TIMEOUT))
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        response = await client.post(url, json=payload)
                        if response.status_code == 200:
                            data = response.json()
                            content = data["candidates"][0]["content"]["parts"][0]["text"]
                            return content
                        else:
                            print(f"[Warning] Gemini API key index {cls.current_key_index} returned {response.status_code}: {response.text}", flush=True)
                            response.raise_for_status()
                except Exception as e:
                    last_exception = e
                    print(f"[Warning] Gemini API call failed with key index {cls.current_key_index}: {e}", flush=True)
                    cls.current_key_index = (cls.current_key_index + 1) % len(cls.GEMINI_KEYS)
                    await asyncio.sleep(0.5)
            raise last_exception or RuntimeError("All Gemini API keys failed")

        url = f"{settings.LM_STUDIO_BASE_URL}/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens
        }
        
        print(f"[Debug Prompt Size] System: {len(system_instruction)} chars, User: {len(user_prompt)} chars, MaxTokens: {max_tokens}", flush=True)
        # response_format is ignored to maintain compatibility with LM Studio versions that do not support json_object
        pass

        delay = 1.0
        last_exception = None

        for attempt in range(1, max_retries + 1):
            try:
                timeout = max(300.0, float(settings.REQUEST_TIMEOUT))
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, json=payload)
                    
                    if response.status_code == 200:
                        data = response.json()
                        content = data["choices"][0]["message"]["content"]
                        return content
                    else:
                        print(f"[Error Details] LM Studio returned 400: {response.text}", flush=True)
                        raise httpx.HTTPStatusError(
                            f"LM Studio returned status {response.status_code}: {response.text}",
                            request=response.request,
                            response=response
                        )
            except (httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
                last_exception = exc
                print(f"[Warning] LM Studio call attempt {attempt}/{max_retries} failed: {type(exc).__name__} - {exc}", flush=True)
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                    delay *= backoff_factor
                else:
                    break

        raise last_exception or RuntimeError(f"Failed to call model {model} after {max_retries} retries")

    @classmethod
    def extract_and_parse_json(cls, text: str) -> Any:
        """
        Cleans and parses raw text output into valid Python objects (dicts/lists).
        Handles standard JSON, trailing commas, single-quoted strings, and code fences.
        """
        text = text.strip()
        
        # 1. Clean markdown code fences if present
        fence_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
        content_to_parse = fence_match.group(1).strip() if fence_match else text

        def clean_mismatched(s: str) -> str:
            # Fix keys/values starting with one quote and ending with another
            # We restrict match to words with letters, numbers, spaces, underscores, hyphens to be safe.
            s = re.sub(r'"([a-zA-Z0-9_\-\s]+)\'\s*:', r'"\1":', s)
            s = re.sub(r'\'([a-zA-Z0-9_\-\s]+)"\s*:', r'"\1":', s)
            s = re.sub(r'"([a-zA-Z0-9_\-\s]+)\'\s*([,}\]])', r'"\1"\2', s)
            s = re.sub(r'\'([a-zA-Z0-9_\-\s]+)"\s*([,}\]])', r'"\1"\2', s)
            return s

        content_to_parse = clean_mismatched(content_to_parse)

        # 2. Try standard json parsing
        try:
            return json.loads(content_to_parse)
        except json.JSONDecodeError:
            pass

        # 3. Try Python literal eval (handles single quotes, trailing commas, etc.)
        try:
            import ast
            return ast.literal_eval(content_to_parse)
        except Exception:
            pass

        # 4. Fallback: extract brace boundaries
        brace_match = re.search(r'(\{.*\}|\[.*\])', content_to_parse, re.DOTALL)
        if brace_match:
            candidate = clean_mismatched(brace_match.group(1).strip())
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
            try:
                import ast
                return ast.literal_eval(candidate)
            except Exception:
                pass

        raise ValueError(f"Could not parse valid JSON from output:\n{text}")
