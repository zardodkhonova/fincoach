import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/history", {
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

  useEffect(() => {
    bottomRef.current &&
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  const appendToken = (aiId, delta) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === aiId ? { ...msg, text: (msg.text || "") + delta } : msg
      )
    );
  };

  const finalizeAi = (aiId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === aiId ? { ...msg, streaming: false } : msg
      )
    );
  };

  const clearHistory = async () => {
    if (streaming || clearing) return;
    setClearing(true);
    try {
      const res = await fetch("/api/chat/history/clear", {
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
    } catch {
      console.error("Failed to clear history");
    } finally {
      setClearing(false);
    }
  };

  const sendMessage = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed || streaming) return;

    const userMsg = { role: "user", id: `u-${Date.now()}`, text: trimmed };
    const aiId = `a-${Date.now()}`;
    const aiPlaceholder = { role: "ai", id: aiId, text: "", streaming: true };

    setMessages((m) => [...m, userMsg, aiPlaceholder]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
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
        const err = await res.json().catch(() => ({}));
        appendToken(aiId, err.error || "Request failed.");
        finalizeAi(aiId);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.replace(/^data:\s*/, "");
          let payload;
          try {
            payload = JSON.parse(jsonStr);
          } catch {
            continue;
          }
          if (payload.error) {
            appendToken(aiId, payload.error);
            continue;
          }
          if (payload.done) {
            finalizeAi(aiId);
            continue;
          }
          if (payload.token) {
            appendToken(aiId, payload.token);
          }
        }
      }

      finalizeAi(aiId);
    } catch {
      appendToken(aiId, "Network error while streaming the reply.");
      finalizeAi(aiId);
    } finally {
      setStreaming(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!historyLoaded) {
    return (
      <div className="chat-page">
        <div className="chat-loading-state">Loading conversation…</div>
      </div>
    );
  }

  return (
    <div className="chat-page">

      <div className="chat-topbar">
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {messages.filter(m => m.id !== "welcome").length > 0
            ? `${messages.filter(m => m.role === "user").length} messages`
            : "New conversation"}
        </span>
        <button
          onClick={clearHistory}
          disabled={streaming || clearing}
          style={{
            fontSize: "12px",
            padding: "5px 14px",
            borderRadius: "20px",
            border: "1px solid var(--border-strong)",
            background: "transparent",
            color: clearing ? "var(--text-hint)" : "var(--text-muted)",
            cursor: streaming || clearing ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {clearing ? "Clearing…" : "Clear conversation"}
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              "chat-msg-block " +
              (m.role === "user" ? "chat-msg-block--user" : "chat-msg-block--ai")
            }
          >
            <div className="chat-msg-label">
              {m.role === "user" ? "You" : "AI Coach"}
            </div>
            <div
              className={
                m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
              }
            >
              {m.text}
              {m.role === "ai" && m.streaming ? (
                <span className="stream-cursor" aria-hidden />
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-chips">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chat-chip"
            disabled={streaming}
            onClick={() => sendMessage(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <form className="chat-input-bar" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Ask about your spending…"
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="chat-send" type="submit" disabled={streaming}>
          Send
        </button>
      </form>
    </div>
  );
}