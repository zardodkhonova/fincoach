"""
coach.py — RAG over retrieved chunks + Groq streaming completions.

Loads GROQ_API_KEY via environment (set in .env and read by app.py / dotenv).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from dotenv import load_dotenv
from groq import Groq

import retriever

_ENV_PATH = Path(__file__).resolve().parent / ".env"

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are FinCoach, a personal finance assistant.

Rules:
- Answer using ONLY the transaction context provided in the user message. Do not invent merchants, dates, or amounts.
- Be specific: cite dollar amounts and months/dates that appear in the context when relevant.
- If the context is insufficient, say exactly what is missing instead of guessing.
- End EVERY reply with a new line, then a line starting with "Saving tip:" followed by one concrete, actionable saving tip that fits the user's situation based on the data (not generic filler)."""


def _build_user_message(question: str, context_chunks: list[str]) -> str:
    """Combine retrieved snippets and the user's question into one user turn."""
    ctx = "\n".join(f"- {c}" for c in context_chunks) if context_chunks else "(no context retrieved)"
    return (
        "Transaction context (ground truth):\n"
        f"{ctx}\n\n"
        f"User question:\n{question.strip()}"
    )


def ask(question: str, user_id: int) -> Iterator[str]:
    """
    Retrieve top-6 chunks for the user, call Groq with streaming enabled,
    yield text deltas.
    """
    load_dotenv(_ENV_PATH)
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_key_here":
        yield "Configuration error: set a valid GROQ_API_KEY in backend/.env."
        return

    chunks = retriever.retrieve(question, int(user_id), k=6)
    user_content = _build_user_message(question, chunks)

    try:
        client = Groq(api_key=api_key)
        stream = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=1024,
            stream=True,
        )

        for event in stream:
            delta = event.choices[0].delta
            if delta and delta.content:
                yield delta.content
    except Exception as e:
        yield f"Sorry, the AI service returned an error: {e}"
