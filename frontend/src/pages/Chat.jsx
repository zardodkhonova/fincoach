import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL;

const WELCOME =
  "Hi — I'm your FinCoach assistant. Ask me anything about the transactions you uploaded. " +
  "I'll stick to your data and include a saving tip at the end of each answer.";

const SUGGESTIONS = [
  "What's my biggest expense?",
  "Compare months",
  "How can I save $200?",
];

export default function Chat() {
  const { token, logout } = useAuth();

  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef(null);

  // ---------------- LOAD HISTORY ----------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          logout();
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        const raw = data.messages || [];

        const mapped = raw.map((m, i) => ({
          id: `hist-${i}-${m.created_at || ""}`,
          role: m.role === "assistant" ? "ai" : "user",
          text: m.content || "",
          streaming: false,
        }));

        if (mapped.length === 0) {
          setMessages([
            { role: "ai", id: "welcome", text: WELCOME, streaming: false },
          ]);
        } else {
          setMessages(mapped);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            { role: "ai", id: "welcome", text: WELCOME, streaming: false },
          ]);
        }
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  // ---------------- SCROLL ----------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ---------------- CLEAR ----------------
  const clearHistory = async () => {
    if (streaming || clearing) return;

    setClearing(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/history/clear`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        logout();
        return;
      }

      setMessages([
        { role: "ai", id: "welcome", text: WELCOME, streaming: false },
      ]);
    } finally {
      setClearing(false);
    }
  };

  // ---------------- SEND MESSAGE ----------------
  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg = { role: "user", id: `u-${Date.now()}`, text: trimmed };
    const aiId = `a-${Date.now()}`;
    const aiPlaceholder = { role: "ai", id: aiId, text: "", streaming: true };

    setMessages((m) => [...m, userMsg, aiPlaceholder]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (res.status === 401) {
        logout();
        setStreaming(false);
        return;
      }

      if (!res.ok) {
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const append = (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, text: m.text + delta } : m
          )
        );
      };

      const finalize = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, streaming: false } : m
          )
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          const jsonStr = line.replace("data:", "").trim();

          let payload;
          try {
            payload = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (payload.token) append(payload.token);
          if (payload.done) finalize();
          if (payload.error) append(payload.error);
        }
      }

      finalize();
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, text: "Network error", streaming: false }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!historyLoaded) {
    return <div className="chat-loading-state">Loading…</div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id}>
            <b>{m.role}</b>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button disabled={streaming}>Send</button>
      </form>

      <button onClick={clearHistory} disabled={clearing || streaming}>
        Clear chat
      </button>
    </div>
  );
}