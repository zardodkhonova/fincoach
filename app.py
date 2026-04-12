"""
app.py — Gradio UI: upload a bank CSV, run ingest, ask questions, get grounded answers
via retriever + Groq. Loads GROQ_API_KEY from .env using python-dotenv.

Run:  python app.py
Then open the local URL Gradio prints (usually http://127.0.0.1:7860).
"""

from __future__ import annotations

from pathlib import Path

import gradio as gr
from dotenv import load_dotenv

from coach import answer_question
from ingest import DEFAULT_OUTPUT_DIR, ingest_csv
from retriever import FinanceRetriever

# Load environment variables from project root .env (GROQ_API_KEY).
load_dotenv(Path(__file__).resolve().parent / ".env")

# Shared retriever instance after a successful ingest in this session.
_retriever: FinanceRetriever | None = None


def do_ingest(csv_file) -> str:
    """
    Gradio passes an uploaded file as a filepath-like object or None.
    Run ingest_csv and refresh the in-memory retriever.
    """
    global _retriever
    if csv_file is None:
        return "Please upload a CSV file first."

    # Gradio may pass a string path or a file-like object with .name
    if isinstance(csv_file, str):
        path = csv_file
    else:
        path = getattr(csv_file, "name", None) or str(csv_file)
    try:
        stats = ingest_csv(path, DEFAULT_OUTPUT_DIR)
        _retriever = FinanceRetriever(DEFAULT_OUTPUT_DIR)
        return (
            f"Ingest complete.\n"
            f"- Chunks created: {stats['chunks']}\n"
            f"- Index: {stats['index_path']}\n"
            f"You can now ask questions about these transactions."
        )
    except Exception as e:
        _retriever = None
        return f"Ingest failed: {e!s}"


def do_ask(question: str) -> str:
    """Retrieve top-6 chunks and call Groq with them as context."""
    global _retriever
    if not question or not question.strip():
        return "Please enter a question."
    if _retriever is None:
        try:
            _retriever = FinanceRetriever(DEFAULT_OUTPUT_DIR)
        except FileNotFoundError:
            return "No index found. Upload and ingest a CSV file first."
    try:
        return answer_question(question, _retriever, top_k=6)
    except Exception as e:
        return f"Error: {e!s}"


def build_ui() -> gr.Blocks:
    """Lay out Gradio components and wire callbacks."""
    with gr.Blocks(title="Personal Finance AI Coach") as demo:
        gr.Markdown(
            "## Personal finance AI coach\n"
            "Upload a bank transaction CSV, then ask questions. "
            "Answers use **retrieved** monthly/category summaries and **Groq** "
            "(llama-3.3-70b-versatile). Set `GROQ_API_KEY` in `.env`."
        )

        with gr.Row():
            file_in = gr.File(label="Bank CSV", file_types=[".csv"])
        ingest_btn = gr.Button("Ingest CSV (build index)")
        ingest_out = gr.Textbox(label="Ingest status", lines=6)

        gr.Markdown("### Ask your coach")
        q = gr.Textbox(label="Your question", placeholder="e.g. How much did I spend on groceries in January?")
        ask_btn = gr.Button("Get answer")
        ans = gr.Textbox(label="Answer", lines=16)

        ingest_btn.click(do_ingest, inputs=[file_in], outputs=[ingest_out])
        ask_btn.click(do_ask, inputs=[q], outputs=[ans])

    return demo


if __name__ == "__main__":
    ui = build_ui()
    ui.launch()
