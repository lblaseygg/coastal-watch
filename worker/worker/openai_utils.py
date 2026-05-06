from __future__ import annotations

import json
import re
from typing import Any

from openai import OpenAI

from worker.core.config import settings


def get_openai_client() -> OpenAI:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    return OpenAI(api_key=settings.openai_api_key)


def parse_json_output(output_text: str) -> Any:
    text = output_text.strip()
    if not text:
        raise ValueError("OpenAI response was empty")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if fenced_match:
        return json.loads(fenced_match.group(1))

    object_match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if object_match:
        return json.loads(object_match.group(1))

    raise ValueError("Could not parse JSON from OpenAI response")
