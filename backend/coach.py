import os
from groq import Groq
from dotenv import load_dotenv
import ingest

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM = """You are a personal finance coach. 
You will be given real transaction data from the user's bank account as context.
Always base your answers strictly on the provided context data.
Be specific — reference exact amounts, dates, and merchant names from the data.
If the context contains relevant information, use it to give a detailed answer.
Always end your response with one concrete saving tip based on the data."""


def ask(question: str, user_id: int):
    try:
        from retriever import retrieve
        context_chunks = retrieve(question, user_id, k=6)
    except Exception as e:
        context_chunks = []

    if not context_chunks:
        state = ingest.USER_INDEXES.get(int(user_id))
        if state and state.get("chunks"):
            context_chunks = [c["text"] for c in state["chunks"][:6]]

    context = "\n".join(context_chunks) if context_chunks else "No transaction data available."

    messages = [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": (
                f"Here is my transaction data:\n\n"
                f"{context}\n\n"
                f"Question: {question}"
            ),
        },
    ]

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.3,
        max_tokens=600,
        stream=True,
    )

    for chunk in response:
        token = chunk.choices[0].delta.content
        if token:
            yield token