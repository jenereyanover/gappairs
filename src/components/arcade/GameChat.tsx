"use client";

// In-game chat overlay (Arcade Neon). Collapsed: a faint peek of recent messages
// bottom-left + a "Chat — Enter" hint. Open: full scrollable history + input.
// Ported from the design's chat.jsx (GameChat). Esc/✕ collapses.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACCENT, ACCENT2, GRAD, RADIUS, hexA } from "lib/arcade";

export interface ChatMsg {
  id: string;
  kind: "system" | "chat";
  author?: string;
  color?: string;
  text: string;
}

function ChatLine({ m, compact }: { m: ChatMsg; compact?: boolean }) {
  if (m.kind === "system") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "center", padding: compact ? "1px 0" : "3px 0", color: "#7a83a0", fontSize: compact ? 12 : 12.5, fontWeight: 600, textAlign: "center" }}>
        <span style={{ color: m.color || "#7a83a0" }}>{m.text}</span>
      </div>
    );
  }
  const sz = compact ? 20 : 24;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: compact ? "2px 0" : "4px 0" }}>
      <span className="font-display" style={{ width: sz, height: sz, flex: `0 0 ${sz}px`, borderRadius: 7, background: m.color || ACCENT, color: "#0b101d", fontWeight: 800, fontSize: compact ? 11 : 12.5, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {(String(m.author || "?").trim().charAt(0) || "?").toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 12.5 : 13, color: m.color || "#cdd4e2", marginRight: 7 }}>{m.author}</span>
        <span style={{ fontSize: compact ? 12.5 : 13.5, color: "#dfe4f0", wordBreak: "break-word", lineHeight: 1.45 }}>{m.text}</span>
      </div>
    </div>
  );
}

function ChatInput({ onSend, autoFocus, onEscape, placeholder }: { onSend: (t: string) => void; autoFocus?: boolean; onEscape?: () => void; placeholder?: string }) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  const send = () => {
    const t = val.trim();
    if (!t) return;
    onSend(t);
    setVal("");
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={ref}
        value={val}
        placeholder={placeholder || "Type a message…"}
        maxLength={140}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onEscape?.();
          }
        }}
        style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: RADIUS - 4, padding: "10px 13px", color: "#e8ecf6", fontSize: 13.5, fontFamily: "inherit", outline: "none" }}
      />
      <button
        onClick={send}
        aria-label="Send"
        className="ch-send font-display"
        style={{ flex: "0 0 auto", background: GRAD, color: "#fff", border: "none", borderRadius: RADIUS - 4, padding: "10px 15px", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: `0 0 20px -8px ${hexA(ACCENT, 0.9)}` }}
      >
        ➤
      </button>
    </div>
  );
}

export default function GameChat({ messages, onSend, open, setOpen }: { messages: ChatMsg[]; onSend: (t: string) => void; open: boolean; setOpen: (v: boolean) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  if (!open) {
    const recent = messages.slice(-3);
    return (
      <div style={{ position: "absolute", left: "clamp(10px,3vw,20px)", bottom: "clamp(10px,3vw,18px)", zIndex: 70, maxWidth: "min(360px, 78%)", display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
        {recent.map((m, i) => (
          <div key={m.id} style={{ opacity: 0.45 + i * 0.18, background: "rgba(10,15,28,.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", borderRadius: RADIUS - 5, padding: "4px 10px", maxWidth: "fit-content" }}>
            <ChatLine m={m} compact />
          </div>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="ch-open"
          style={{ pointerEvents: "auto", marginTop: 4, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(10,15,28,.6)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 13px", color: "#aeb6c8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          <span>💬</span>
          <span>Chat</span>
          <kbd style={{ background: "rgba(255,255,255,.1)", borderRadius: 4, padding: "1px 6px", fontSize: 10.5, fontWeight: 700, fontFamily: "inherit" }}>Enter</kbd>
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", left: "clamp(10px,3vw,20px)", bottom: "clamp(10px,3vw,18px)", zIndex: 72, width: "min(360px, 90%)", display: "flex", flexDirection: "column", background: "rgba(10,15,28,.92)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${hexA(ACCENT2, 0.4)}`, borderRadius: RADIUS + 2, overflow: "hidden", boxShadow: `0 24px 60px -24px rgba(0,0,0,.8), 0 0 40px -16px ${hexA(ACCENT2, 0.5)}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#9aa3ba", display: "flex", alignItems: "center", gap: 7 }}>
          <span>💬</span> CHAT
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="ch-x" style={{ background: "transparent", border: "none", color: "#6b7488", fontSize: 16, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>
          ✕
        </button>
      </div>
      <div ref={listRef} className="no-scrollbar" style={{ maxHeight: "min(260px, 40vh)", minHeight: 90, overflowY: "auto", padding: "10px 13px", display: "flex", flexDirection: "column", gap: 1 }}>
        {messages.length === 0 ? (
          <div style={{ color: "#56607a", fontSize: 12.5, textAlign: "center", margin: "auto 0" }}>No messages yet.</div>
        ) : (
          messages.map((m) => <ChatLine key={m.id} m={m} />)
        )}
      </div>
      <div style={{ padding: 11, borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <ChatInput onSend={onSend} autoFocus onEscape={() => setOpen(false)} placeholder="Message the lobby…" />
      </div>
    </div>
  );
}
