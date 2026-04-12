"""
coach.py — Retrieve relevant transaction chunks, then call Groq's chat API
(model: llama-3.3-70b-versatile) with those chunks as grounding context.

Loads GROQ_API_KEY from the environment (use python-dotenv in app.py or here before calling).
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

from retriever import FinanceRetriever, DEFAULT_DATA_DIR

# Groq model id (as requested).
GROQ_MODEL = "llama-3.3-70b-versatile"

# How many chunks to inject into the prompt (matches your RAG design).
DEFAULT_TOP_K = 6

# System instructions: keep answers tied to retrieved data and safe for finance coaching.
SYSTEM_PROMPT = """You are a personal finance coach. You answer using ONLY the transaction
context provided by the user message. If the context does not contain enough information,
say what is missing instead of inventing numbers or categories. Use clear, concise language.
When you cite figures, tie them to the month and category shown in the context."""


def _format_context_block(hits: list[dict]) -> str:
    """Turn retriever hits into a single string for the user turn."""
    parts: list[str] = []
    for h in hits:
        header = f"--- Chunk {h['rank']} (score={h['score']:.4f}, {h.get('year_month')}, {h.get('category')}) ---"
        parts.append(header + "\n" + h["text"])
    return "\n\n".join(parts)


def answer_question(
    question: str,
    retriever: FinanceRetriever,
    *,
    top_k: int = DEFAULT_TOP_K,
    api_key: str | None = None,
) -> str:
    """
    RAG loop: retrieve → build messages → Groq chat completion → return assistant text.

    `api_key` overrides GROQ_API_KEY when provided (useful for tests).
    """
    # Ensure .env is loaded when coach is used standalone (e.g. tests / scripts).
    load_dotenv(Path(__file__).resolve().parent / ".env")

    key = api_key or os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to a .env file or export it in your environment."
        )

    hits = retriever.search(question.strip(), k=top_k)
    if not hits:
        return "No transaction chunks are available yet. Ingest a CSV file first."

    context = _format_context_block(hits)
    user_content = (
        "Here are retrieved transaction summaries (by month and category):\n\n"
        f"{context}\n\n"
        f"User question: {question.strip()}"
    )

    client = Groq(api_key=key)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=1024,
    )

    choice = completion.choices[0].message
    return (choice.content or "").strip()
