"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "components/Card";
import { useAuth } from "context/AuthProvider";
import { MAX_PLAYERS, membersByAge, type ChatMessage } from "lib/lobby";
import { useLobby } from "lib/useLobby";
import { rtdbEnabled } from "lib/firebase";
import { fetchImageSets, type ImageSet } from "lib/imageSets";
import { isMuted, playFlip, playMatch, playWrong, setMuted } from "utils/sound";
import { playerColor } from "utils/players";
import { ACCENT, ACCENT2, GRAD, RADIUS, SCREEN_BG, PANEL_BG, DIFFS, hexA } from "lib/arcade";
import PackScroller, { buildPacks } from "components/arcade/PackScroller";
import GameChat, { type ChatMsg } from "components/arcade/GameChat";

const R = RADIUS;
const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".16em",
  color: "#7a83a0",
  marginBottom: 12,
  whiteSpace: "nowrap",
};

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();
  const { user, profile, loading, enabled, signIn, signInGuest } = useAuth();
  const myNick = profile?.nickname || "Guest";

  const [guestError, setGuestError] = useState<string | null>(null);
  const guestTried = useRef(false);

  // No login required: sign in as a guest (anonymous) so we have an identity.
  useEffect(() => {
    if (!rtdbEnabled || loading || user || guestTried.current) return;
    guestTried.current = true;
    signInGuest().catch(() =>
      setGuestError("Couldn’t join as a guest. Enable Anonymous sign-in in Firebase, or log in below.")
    );
  }, [rtdbEnabled, loading, user, signInGuest]);

  const {
    lobby,
    loaded,
    joinError,
    kicked,
    isLeader,
    isMyTurn,
    isSpectator,
    setNickname,
    setDimension,
    setImageSet,
    startGame,
    restartGame,
    flip,
    kick,
    sendChat,
    leave,
  } = useLobby(code, user?.uid, myNick);

  // Selectable image sets (leader picks one or more to mix with emojis).
  const [sets, setSets] = useState<ImageSet[]>([]);
  useEffect(() => {
    fetchImageSets()
      .then(setSets)
      .catch(() => setSets([]));
  }, []);
  const onSelectSets = (ids: string[]) => {
    const chosen = sets.filter((s) => ids.includes(s.id));
    const urls = chosen.flatMap((s) => s.images.map((i) => i.url));
    setImageSet(ids, urls, chosen.map((s) => s.name).join(", ") || null);
  };

  const [nickDraft, setNickDraft] = useState("");
  const nickInit = useRef(false);
  useEffect(() => {
    if (!user || nickInit.current) return;
    const mine = lobby?.members?.[user.uid]?.nickname;
    if (mine !== undefined) {
      setNickDraft(mine);
      nickInit.current = true;
    }
  }, [lobby, user]);

  const [copied, setCopied] = useState(false);
  const copyInvite = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/lobby/${code}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const [muted, setMutedState] = useState(() => isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  // Play correct / wrong sounds for every client as the synced game resolves.
  const prevMatched = useRef<number | null>(null);
  const prevResolving = useRef(false);
  useEffect(() => {
    const g = lobby?.game;
    if (!g) {
      prevMatched.current = null;
      prevResolving.current = false;
      return;
    }
    const matchedCount = g.matchedBy ? Object.keys(g.matchedBy).length : 0;
    const resolving = !!g.resolving;
    if (prevMatched.current === null || matchedCount < prevMatched.current) {
      prevMatched.current = matchedCount;
      prevResolving.current = resolving;
      return;
    }
    if (matchedCount > prevMatched.current) playMatch();
    else if (prevResolving.current && !resolving) playWrong();
    prevMatched.current = matchedCount;
    prevResolving.current = resolving;
  }, [lobby?.game]);

  // Chat — sorted by push key (chronological).
  const chatMessages = useMemo(() => {
    const c = lobby?.chat || {};
    return Object.entries(c)
      .map(([id, m]) => ({ id, ...(m as ChatMessage) }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [lobby?.chat]);
  const [chatDraft, setChatDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [chatMessages.length]);

  // In-game chat overlay: Enter opens it (when not typing); resets out of game.
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => {
    const ig = !!lobby && lobby.status !== "waiting" && !!lobby.game;
    if (!ig) {
      setChatOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || chatOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      setChatOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lobby, chatOpen]);
  const onSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const t = chatDraft.trim();
    if (!t) return;
    sendChat(t);
    setChatDraft("");
  };

  const onLeave = async () => {
    await leave();
    router.push("/");
  };

  // ---- Gates ----
  if (!rtdbEnabled) {
    return (
      <Shell>
        <Notice text="Online play needs the Realtime Database — add NEXT_PUBLIC_FIREBASE_DATABASE_URL to .env.local." />
      </Shell>
    );
  }
  if (loading) return <Shell><Joining /></Shell>;
  if (!user) {
    return (
      <Shell>
        {guestError ? (
          <Notice text={guestError}>
            <button onClick={signIn} style={loginBtn}>Log in with Google</button>
          </Notice>
        ) : (
          <Joining />
        )}
      </Shell>
    );
  }
  if (kicked) {
    return (
      <Shell>
        <Notice text="You were removed from the lobby by the leader.">
          <BackToMenu router={router} />
        </Notice>
      </Shell>
    );
  }
  if (joinError) {
    return (
      <Shell>
        <Notice text={joinError}>
          <BackToMenu router={router} />
        </Notice>
      </Shell>
    );
  }
  if (loaded && !lobby) {
    return (
      <Shell>
        <Notice text="This lobby doesn’t exist or has closed.">
          <BackToMenu router={router} />
        </Notice>
      </Shell>
    );
  }
  if (!lobby) return <Shell><Joining /></Shell>;

  const order = membersByAge(lobby.members);
  const game = lobby.game;
  const dimension = game?.dimension ?? lobby.settings?.dimension ?? 4;
  const inGame = lobby.status !== "waiting" && !!game;
  const colorIndex = (uid: string, arr: string[]) => {
    const i = arr.indexOf(uid);
    return i < 0 ? 0 : i;
  };
  const memberName = (uid: string) => lobby.members?.[uid]?.nickname || "Player";
  const isPlayer = (uid: string) => !inGame || (game?.turnOrder || []).includes(uid);

  // pack selection (image sets) — "emojis" shown selected when no sets chosen
  const imageSetIds = lobby.settings?.imageSetIds ?? [];
  const selectedPackIds = imageSetIds.length ? imageSetIds : ["emojis"];
  const onTogglePack = (id: string) => {
    if (!isLeader) return;
    if (id === "emojis") {
      if (imageSetIds.length) onSelectSets([]);
      return;
    }
    onSelectSets(imageSetIds.includes(id) ? imageSetIds.filter((x) => x !== id) : [...imageSetIds, id]);
  };

  // board sizing
  const board = dimension <= 4 ? 440 : dimension <= 6 ? 560 : 680;
  const gap = dimension <= 4 ? 11 : dimension <= 6 ? 8 : 6;
  const glyphFont =
    dimension <= 4 ? "clamp(24px, 6vmin, 40px)" : dimension <= 6 ? "clamp(15px, 4vmin, 28px)" : "clamp(10px, 2.8vmin, 20px)";
  const tileR = Math.max(6, Math.min(R, dimension > 6 ? 9 : 14));

  const slots: (string | null)[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) slots.push(order[i] || null);

  // Normalize chat for the in-game overlay (system logs + colored authors).
  const chatForGame: ChatMsg[] = chatMessages.map((m) =>
    m.system
      ? { id: m.id, kind: "system", text: m.text }
      : {
          id: m.id,
          kind: "chat",
          author: lobby.members?.[m.uid ?? ""]?.nickname || m.name || "Player",
          color: order.indexOf(m.uid ?? "") >= 0 ? playerColor(order.indexOf(m.uid ?? "")) : "#9aa3ba",
          text: m.text,
        }
  );

  return (
    <div style={{ minHeight: "100vh", background: SCREEN_BG, color: "#e8ecf6", overflowY: "auto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "clamp(16px,3vw,28px) clamp(16px,4vw,32px) 48px" }}>
        {/* top bar */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: hexA(ACCENT2, 0.08), border: `1px solid ${hexA(ACCENT2, 0.3)}`, borderRadius: R, padding: "10px 14px" }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", color: "#8b94a8", marginBottom: 3 }}>LOBBY CODE</div>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: ".12em", color: "#fff", lineHeight: 1 }}>{code}</div>
            </div>
            <button onClick={copyInvite} className="c-friend" style={{ background: copied ? hexA(ACCENT2, 0.25) : "rgba(255,255,255,.06)", color: copied ? "#fff" : "#dfe4f0", border: `1px solid ${hexA(ACCENT2, 0.4)}`, borderRadius: R - 4, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {copied ? "✓ Copied" : "Invite"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className="gb-ctrl" style={{ ...ctrlBtn, width: 40, padding: 0 }}>
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={onLeave} className="c-friend" style={{ ...ctrlBtn, padding: "0 18px" }}>Leave</button>
          </div>
        </div>

        {isSpectator && (
          <p style={{ marginTop: 14, display: "inline-block", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "#aeb6c8" }}>
            👀 You’re spectating — you’ll join when the leader starts the next game.
          </p>
        )}

        <div className="lobby-grid" style={{ display: "grid", gridTemplateColumns: inGame ? "1fr" : "1.05fr 1fr", gap: 22, marginTop: 18, alignItems: "start" }}>
          {/* PLAYERS */}
          <div style={{ minWidth: 0 }}>
            <div style={{ ...sectionLabel, display: "flex", justifyContent: "space-between" }}>
              <span>PLAYERS</span>
              <span style={{ color: "#6b7488" }}>{order.length}/{MAX_PLAYERS}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {slots.map((uid, i) => {
                if (!uid) {
                  return (
                    <div key={`empty-${i}`} style={{ display: "flex", alignItems: "center", gap: 11, border: "1px dashed rgba(255,255,255,.12)", borderRadius: R - 4, padding: "9px 12px", color: "#56607a" }}>
                      <span style={{ width: 32, height: 32, flex: "0 0 32px", borderRadius: 9, border: "1px dashed rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>+</span>
                      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Waiting for player…</span>
                    </div>
                  );
                }
                const col = playerColor(i);
                const isMe = uid === user.uid;
                const isHost = lobby.leader === uid;
                const spectating = inGame && !isPlayer(uid);
                return (
                  <div key={uid} className="c-lobby-row" style={{ display: "flex", alignItems: "center", gap: 11, background: isMe ? hexA(col, 0.1) : "rgba(255,255,255,.03)", border: `1px solid ${isMe ? hexA(col, 0.5) : "rgba(255,255,255,.08)"}`, borderRadius: R - 4, padding: "9px 12px" }}>
                    <span className="font-display" style={{ width: 32, height: 32, flex: "0 0 32px", borderRadius: 9, background: col, color: "#0b101d", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px -2px ${hexA(col, 0.8)}` }}>
                      {(memberName(uid).trim().charAt(0) || "?").toUpperCase()}
                    </span>
                    {isMe ? (
                      <input
                        value={nickDraft}
                        onChange={(e) => { setNickDraft(e.target.value); setNickname(e.target.value); }}
                        maxLength={16}
                        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#e8ecf6", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}
                      />
                    ) : (
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: "#e8ecf6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memberName(uid)}</span>
                    )}
                    {isMe && <span style={{ fontSize: 12, color: "#6b7488", fontWeight: 600 }}>you</span>}
                    {spectating && <span style={{ fontSize: 11.5, color: "#6b7488" }}>spectating</span>}
                    {isHost && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", color: "#f5c542", background: "rgba(245,197,66,.12)", border: "1px solid rgba(245,197,66,.3)", borderRadius: 6, padding: "3px 7px", flex: "0 0 auto" }}>HOST</span>
                    )}
                    {isLeader && lobby.status === "waiting" && !isMe && (
                      <button onClick={() => kick(uid)} aria-label={`Kick ${memberName(uid)}`} title="Kick player" style={{ flex: "0 0 auto", background: "transparent", border: "none", color: "#6b7488", cursor: "pointer", fontSize: 14, padding: "2px 4px", borderRadius: 6 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SETTINGS (waiting room only) */}
          {!inGame && (
            <div style={{ minWidth: 0 }}>
              <div style={{ ...sectionLabel, display: "flex", justifyContent: "space-between" }}>
                <span>TILE PACKS</span>
                <span style={{ color: "#6b7488", fontWeight: 600, letterSpacing: ".04em" }}>{isLeader ? `${selectedPackIds.length} selected` : "set by host"}</span>
              </div>
              <PackScroller packs={buildPacks(sets.filter((s) => s.status === "published"))} selectedIds={selectedPackIds} onToggle={onTogglePack} readOnly={!isLeader} size="sm" />

              <div style={{ ...sectionLabel, marginTop: 18 }}>DIFFICULTY</div>
              <div style={{ display: "flex", gap: 9 }}>
                {DIFFS.map((d) => {
                  const on = d.n === (lobby.settings?.dimension ?? 4);
                  return (
                    <button
                      key={d.id}
                      onClick={isLeader ? () => setDimension(d.n) : undefined}
                      className={isLeader ? "c-diff" : ""}
                      style={{ flex: 1, border: `1.5px solid ${on ? d.color : "rgba(255,255,255,.1)"}`, background: on ? `rgba(${d.tint},.14)` : "rgba(255,255,255,.02)", boxShadow: on ? `0 0 0 1.5px ${d.color}, 0 0 26px -10px ${d.color}` : "none", borderRadius: R - 2, padding: "12px 6px", cursor: isLeader ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: "inherit", opacity: !isLeader && !on ? 0.45 : 1, transition: "all .15s" }}
                    >
                      <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: on ? "#fff" : "#cdd4e2" }}>{d.label}</span>
                      <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: on ? d.color : "#8b94a8" }}>{d.grid}</span>
                    </button>
                  );
                })}
              </div>

              {isLeader ? (
                <button
                  onClick={() => startGame()}
                  disabled={order.length < 2}
                  className="c-start font-display"
                  style={{ width: "100%", marginTop: 20, background: order.length < 2 ? "rgba(255,255,255,.06)" : GRAD, color: order.length < 2 ? "#56607a" : "#fff", border: "none", borderRadius: R - 2, padding: 15, fontWeight: 800, fontSize: 16, letterSpacing: ".03em", cursor: order.length < 2 ? "default" : "pointer", boxShadow: order.length < 2 ? "none" : `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}
                >
                  {order.length < 2 ? "Waiting for another player…" : "▶ Start game"}
                </button>
              ) : (
                <p style={{ marginTop: 18, fontSize: 13.5, color: "#8b94a8" }}>
                  Waiting for <span style={{ fontWeight: 700, color: "#e8ecf6" }}>{memberName(lobby.leader)}</span> to start the game…
                </p>
              )}
            </div>
          )}
        </div>

        {/* In-game board */}
        {inGame && game && (
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {(game.turnOrder || []).map((uid) => {
                const col = playerColor(colorIndex(uid, game.turnOrder || []));
                const active = game.turnUid === uid && lobby.status === "playing";
                return (
                  <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: active ? hexA(col, 0.16) : "rgba(255,255,255,.04)", border: `1.5px solid ${active ? col : "rgba(255,255,255,.08)"}`, boxShadow: active ? `0 0 20px -6px ${col}` : "none" }}>
                    <span className="font-display" style={{ width: 22, height: 22, borderRadius: 7, background: col, color: "#0b101d", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {(memberName(uid).trim().charAt(0) || "?").toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: active ? "#fff" : "#cdd4e2", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memberName(uid)}</span>
                    <span className="font-display" style={{ fontWeight: 800, fontSize: 15, color: col }}>{game.scores?.[uid] ?? 0}</span>
                  </div>
                );
              })}
            </div>

            {lobby.status === "playing" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8, fontSize: 14 }}>
                {isMyTurn ? (
                  <span style={{ fontWeight: 800, color: ACCENT2 }}>Your turn!</span>
                ) : isSpectator ? (
                  <span style={{ color: "#9aa3ba" }}>Spectating</span>
                ) : (
                  <span style={{ color: "#9aa3ba" }}>Turn: <span style={{ fontWeight: 700, color: "#e8ecf6" }}>{memberName(game.turnUid)}</span></span>
                )}
                {isLeader && (
                  <button onClick={() => restartGame()} className="gb-ctrl" style={{ ...ctrlBtn, height: 30, padding: "0 12px", fontSize: 12.5 }} title="Deal a new board for everyone">↻ New game</button>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <div style={{ position: "relative", width: `min(92vw, ${board}px)` }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${dimension}, 1fr)`, gap, fontSize: glyphFont }}>
                  {(game.tiles || []).map((emoji, i) => {
                    const ownerUid = game.matchedBy?.[i];
                    const isPaired = ownerUid !== undefined;
                    const isOpen = (game.open || []).includes(i);
                    const matchColor = isPaired ? playerColor(colorIndex(ownerUid, game.turnOrder || [])) : ACCENT;
                    const disabled = !isMyTurn || lobby.status !== "playing" || game.resolving || isPaired || isOpen;
                    return (
                      <Card
                        key={i}
                        emoji={emoji}
                        open={isOpen}
                        paired={isPaired}
                        matchColor={matchColor}
                        radius={tileR}
                        disabled={disabled}
                        onClick={() => { if (!disabled) playFlip(); flip(i); }}
                      />
                    );
                  })}
                </div>

                {lobby.status === "playing" && (
                  <GameChat messages={chatForGame} onSend={(t) => sendChat(t)} open={chatOpen} setOpen={setChatOpen} />
                )}

                {/* Paused — overlaid on the board so chat stays usable */}
                {lobby.status === "paused" && (
                  <BoardOverlay>
                    <div style={{ fontSize: 40 }}>⏸️</div>
                    <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 4px" }}>Game paused</h2>
                    <p style={{ fontSize: 13.5, color: "#9aa3ba", margin: 0 }}>{lobby.pausedReason || "A player left."}</p>
                    {isLeader ? (
                      <button onClick={() => restartGame()} className="c-start font-display" style={{ marginTop: 16, background: GRAD, color: "#fff", border: "none", borderRadius: R - 2, padding: "12px 28px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}>Restart game</button>
                    ) : (
                      <p style={{ marginTop: 12, fontSize: 13.5, color: "#9aa3ba" }}>Waiting for <span style={{ fontWeight: 700, color: "#e8ecf6" }}>{memberName(lobby.leader)}</span> to restart…</p>
                    )}
                  </BoardOverlay>
                )}

                {/* Finished — leader plays again or picks a new size */}
                {lobby.status === "finished" && (
                  <BoardOverlay>
                    <div style={{ fontSize: 40 }}>{game.winnerUid === "tie" ? "🤝" : "🏆"}</div>
                    <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 6px" }}>
                      {game.winnerUid === "tie" ? "It’s a tie!" : `${memberName(game.winnerUid || "")} wins!`}
                    </h2>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2px 10px", fontSize: 13.5 }}>
                      {(game.turnOrder || []).map((pid, i) => (
                        <span key={pid} style={{ fontWeight: 700, color: playerColor(i) }}>{memberName(pid)} {game.scores?.[pid] ?? 0}</span>
                      ))}
                    </div>
                    {isLeader ? (
                      <>
                        <button onClick={() => startGame()} className="c-start font-display" style={{ marginTop: 16, width: "100%", background: GRAD, color: "#fff", border: "none", borderRadius: R - 2, padding: 12, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}>
                          Play again ({dimension}×{dimension})
                        </button>
                        <p style={{ marginTop: 12, fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", color: "#6b7488", textTransform: "uppercase" }}>or pick a new size</p>
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 8 }}>
                          {DIFFS.map((d) => (
                            <button key={d.id} onClick={() => startGame(d.n)} className="c-diff" style={{ borderRadius: 9, border: `1.5px solid ${d.n === dimension ? d.color : "rgba(255,255,255,.12)"}`, background: d.n === dimension ? `rgba(${d.tint},.16)` : "rgba(255,255,255,.03)", color: d.n === dimension ? "#fff" : "#cdd4e2", padding: "6px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{d.grid}</button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ marginTop: 14, fontSize: 13.5, color: "#9aa3ba" }}>Waiting for <span style={{ fontWeight: 700, color: "#e8ecf6" }}>{memberName(lobby.leader)}</span> to start a new game…</p>
                    )}
                  </BoardOverlay>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat — full panel everywhere except active play (the board overlay handles that). */}
        {lobby.status !== "playing" && (
        <div style={{ marginTop: 24 }}>
          <div style={sectionLabel}>CHAT</div>
          <div style={{ borderRadius: R, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", padding: 12 }}>
            <div style={{ height: 168, overflowY: "auto", paddingRight: 4, fontSize: 13.5, display: "flex", flexDirection: "column", gap: 3 }} className="no-scrollbar">
              {chatMessages.length === 0 ? (
                <p style={{ color: "#56607a" }}>No messages yet. Say hi! 👋</p>
              ) : (
                chatMessages.map((m) => {
                  if (m.system) {
                    return <div key={m.id} style={{ textAlign: "center", fontStyle: "italic", color: "#6b7488", fontSize: 12, padding: "2px 0" }}>{m.text}</div>;
                  }
                  const idx = order.indexOf(m.uid ?? "");
                  const col = idx >= 0 ? playerColor(idx) : "#9aa3ba";
                  const sender = lobby.members?.[m.uid ?? ""]?.nickname || m.name || "Player";
                  return (
                    <div key={m.id} style={{ wordBreak: "break-word" }}>
                      <span style={{ fontWeight: 700, color: col }}>{sender}</span>
                      <span style={{ color: "#56607a" }}>: </span>
                      <span style={{ color: "#dfe4f0" }}>{m.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={onSendChat} style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                maxLength={200}
                placeholder="Message…"
                style={{ flex: 1, borderRadius: R - 4, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", padding: "10px 12px", fontSize: 13.5, color: "#e8ecf6", outline: "none", fontFamily: "inherit" }}
              />
              <button type="submit" disabled={!chatDraft.trim()} className="c-start font-display" style={{ borderRadius: R - 4, background: GRAD, color: "#fff", border: "none", padding: "0 20px", fontSize: 14, fontWeight: 700, cursor: chatDraft.trim() ? "pointer" : "default", opacity: chatDraft.trim() ? 1 : 0.5 }}>Send</button>
            </form>
          </div>
        </div>
        )}
      </div>

      <style>{`@media (max-width: 680px) { .lobby-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 40,
  borderRadius: RADIUS - 4,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#dfe4f0",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all .15s",
};
const loginBtn: React.CSSProperties = {
  marginTop: 16,
  background: "#fff",
  color: "#1a1f2e",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};

function BoardOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: RADIUS, background: "rgba(7,11,21,.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: 16 }}>
      <div style={{ width: "min(320px, 100%)", textAlign: "center", background: PANEL_BG, border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS, padding: 24, boxShadow: "0 30px 70px -30px rgba(0,0,0,.8)" }}>
        {children}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: SCREEN_BG, color: "#e8ecf6", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(440px, 100%)" }}>{children}</div>
    </div>
  );
}

function Joining() {
  return <p style={{ color: "#9aa3ba", textAlign: "center" }}>Joining…</p>;
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div style={{ background: PANEL_BG, border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS + 4, padding: 28, textAlign: "center", boxShadow: `0 30px 70px -30px rgba(0,0,0,.8)` }}>
      <p style={{ color: "#cdd4e2", margin: 0 }}>{text}</p>
      {children}
    </div>
  );
}

function BackToMenu({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button onClick={() => router.push("/")} className="c-start font-display" style={{ marginTop: 16, background: GRAD, color: "#fff", border: "none", borderRadius: RADIUS - 2, padding: "12px 24px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}>
      Back to menu
    </button>
  );
}
