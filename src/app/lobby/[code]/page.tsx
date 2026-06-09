"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import classNames from "classnames";
import Card from "components/Card";
import { useAuth } from "context/AuthProvider";
import { MAX_PLAYERS, membersByAge, type ChatMessage } from "lib/lobby";
import { useLobby } from "lib/useLobby";
import { rtdbEnabled } from "lib/firebase";
import { fetchImageSets, type ImageSet } from "lib/imageSets";
import TileSetPicker from "components/TileSetPicker";
import { PALETTE } from "utils/players";
import { isMuted, playFlip, playMatch, playWrong, setMuted } from "utils/sound";

const SIZES = [4, 6, 8, 10, 12];

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

  // Selectable image sets (leader picks one to mix with emojis).
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
        <p className="rounded-lg bg-slate-800 p-4 text-slate-300">
          Online play needs the Realtime Database — add <code>NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> to{" "}
          <code>.env.local</code>.
        </p>
      </Shell>
    );
  }
  if (loading) return <Shell>{<p className="text-slate-400">Loading…</p>}</Shell>;
  if (!user) {
    return (
      <Shell>
        {guestError ? (
          <Notice text={guestError}>
            <button onClick={signIn} className="mt-4 rounded-md bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100">
              Log in with Google
            </button>
          </Notice>
        ) : (
          <p className="text-slate-400">Joining…</p>
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
  if (!lobby) return <Shell>{<p className="text-slate-400">Joining…</p>}</Shell>;

  const order = membersByAge(lobby.members);
  const game = lobby.game;
  const dimension = game?.dimension ?? lobby.settings?.dimension ?? 4;
  const inGame = lobby.status !== "waiting" && !!game;
  const colorIndex = (uid: string, arr: string[]) => {
    const i = arr.indexOf(uid);
    return (i < 0 ? 0 : i) % PALETTE.length;
  };
  const memberName = (uid: string) => lobby.members?.[uid]?.nickname || "Player";
  const isPlayer = (uid: string) => !inGame || (game?.turnOrder || []).includes(uid);

  const boardWidth = `min(94vw, ${dimension >= 10 ? 46 : 34}rem)`;
  const tileFont = `calc(${boardWidth} / ${dimension} * 0.5)`;
  const tileGap = `calc(${boardWidth} / ${dimension} * 0.08)`;

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 px-4 pb-12 pt-6 text-slate-100">
      {/* Top bar */}
      <header className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Lobby</span>
          <span className="rounded-md bg-slate-800 px-2.5 py-1 font-mono text-lg font-bold tracking-widest">{code}</span>
          <button onClick={copyInvite} className="rounded-md bg-slate-700 px-2.5 py-1 text-sm hover:bg-slate-600">
            {copied ? "Copied!" : "Invite"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            aria-pressed={muted}
            className="rounded-md bg-slate-700 px-2.5 py-1.5 text-sm hover:bg-slate-600"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={onLeave} className="rounded-md bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
            Leave
          </button>
        </div>
      </header>

      {/* Players */}
      <section className="mt-5 w-full max-w-3xl">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Players ({order.length}/{MAX_PLAYERS})
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {order.map((uid, i) => {
            const pal = PALETTE[i % PALETTE.length];
            const isMe = uid === user.uid;
            const spectating = inGame && !isPlayer(uid);
            return (
              <div
                key={uid}
                className={classNames(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1",
                  isMe ? "bg-slate-800 ring-indigo-400/60" : "bg-slate-800 ring-transparent"
                )}
              >
                <span className={classNames("h-2.5 w-2.5 rounded-full", pal.dot)} />
                {lobby.leader === uid && <span title="Lobby leader">👑</span>}
                {isMe ? (
                  <input
                    value={nickDraft}
                    onChange={(e) => {
                      setNickDraft(e.target.value);
                      setNickname(e.target.value);
                    }}
                    maxLength={16}
                    className="w-28 bg-transparent font-semibold text-slate-100 focus:outline-none"
                  />
                ) : (
                  <span className="font-semibold">{memberName(uid)}</span>
                )}
                {isMe && <span className="text-xs text-indigo-300">you</span>}
                {spectating && <span className="text-xs text-slate-500">spectating</span>}
                {isLeader && lobby.status === "waiting" && !isMe && (
                  <button
                    onClick={() => kick(uid)}
                    aria-label={`Kick ${memberName(uid)}`}
                    title="Kick player"
                    className="ml-1 rounded-full px-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isSpectator && (
        <p className="mt-3 rounded-full bg-slate-800 px-4 py-1.5 text-sm text-slate-300">
          👀 You’re spectating — you’ll join when the leader starts the next game.
        </p>
      )}

      {/* Waiting room */}
      {lobby.status === "waiting" && (
        <section className="mt-6 w-full max-w-md rounded-xl bg-slate-800 p-5 text-center">
          {isLeader ? (
            <>
              <h3 className="text-sm font-semibold text-slate-300">Choose a board size</h3>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SIZES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDimension(d)}
                    className={classNames(
                      "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                      (lobby.settings?.dimension ?? 4) === d
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-900 text-slate-400 hover:text-white"
                    )}
                  >
                    {d}×{d}
                  </button>
                ))}
              </div>
              {sets.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Tiles <span className="font-normal normal-case tracking-normal text-slate-600">· pick one or more</span>
                  </p>
                  <TileSetPicker
                    sets={sets}
                    selectedIds={lobby.settings?.imageSetIds ?? []}
                    onChange={onSelectSets}
                  />
                </div>
              )}
              <button
                onClick={() => startGame()}
                disabled={order.length < 2}
                className="mt-5 w-full rounded-md bg-indigo-500 px-4 py-2.5 font-semibold transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {order.length < 2 ? "Waiting for another player…" : "Start game"}
              </button>
              <p className="mt-3 text-xs text-slate-500">Share the code or Invite link to bring friends in.</p>
            </>
          ) : (
            <>
              <p className="text-slate-300">
                Waiting for <span className="font-semibold">{memberName(lobby.leader)}</span> to start the game…
              </p>
              {lobby.settings?.imageSetName && (
                <p className="mt-2 text-xs text-slate-500">Tiles: {lobby.settings.imageSetName}</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Game board */}
      {inGame && game && (
        <>
          <div className="mt-5 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
            {(game.turnOrder || []).map((uid) => {
              const pal = PALETTE[colorIndex(uid, game.turnOrder || [])];
              const active = game.turnUid === uid && lobby.status === "playing";
              return (
                <div
                  key={uid}
                  className={classNames(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-2",
                    active ? pal.chipActive : "text-slate-400 ring-transparent"
                  )}
                >
                  <span className={classNames("h-2.5 w-2.5 rounded-full", pal.dot)} />
                  <span className="max-w-[7rem] truncate">{memberName(uid)}</span>
                  <span className="tabular-nums">{game.scores?.[uid] ?? 0}</span>
                </div>
              );
            })}
          </div>

          {lobby.status === "playing" && (
            <div className="mt-2 flex items-center gap-3">
              <p className="text-sm">
                {isMyTurn ? (
                  <span className="font-bold text-indigo-300">Your turn!</span>
                ) : isSpectator ? (
                  <span className="text-slate-400">Spectating</span>
                ) : (
                  <span className="text-slate-400">
                    Turn: <span className="font-semibold">{memberName(game.turnUid)}</span>
                  </span>
                )}
              </p>
              {isLeader && (
                <button
                  onClick={() => restartGame()}
                  className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-600"
                  title="Deal a new board for everyone (includes spectators)"
                >
                  ↻ New game
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex w-full justify-center">
            <div className="relative" style={{ width: boardWidth }}>
              <div
                style={{
                  width: "100%",
                  fontSize: tileFont,
                  gap: tileGap,
                  display: "grid",
                  gridTemplateColumns: `repeat(${dimension}, minmax(0, 1fr))`,
                }}
              >
                {(game.tiles || []).map((emoji, i) => {
                  const ownerUid = game.matchedBy?.[i];
                  const isPaired = ownerUid !== undefined;
                  const isOpen = (game.open || []).includes(i);
                  const matchClass = isPaired ? PALETTE[colorIndex(ownerUid, game.turnOrder || [])].match : undefined;
                  const disabled = !isMyTurn || lobby.status !== "playing" || game.resolving || isPaired || isOpen;
                  return (
                    <Card
                      key={i}
                      emoji={emoji}
                      open={isOpen}
                      paired={isPaired}
                      matchClass={matchClass}
                      disabled={disabled}
                      onClick={() => {
                        if (!disabled) playFlip();
                        flip(i);
                      }}
                    />
                  );
                })}
              </div>

              {/* Paused — overlaid on the board so chat stays usable */}
              {lobby.status === "paused" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/80 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-xs rounded-2xl bg-slate-800/95 p-6 text-center shadow-xl ring-1 ring-slate-700">
                    <p className="text-4xl">⏸️</p>
                    <h2 className="mt-2 text-xl font-bold">Game paused</h2>
                    <p className="mt-1 text-sm text-slate-300">{lobby.pausedReason || "A player left."}</p>
                    {isLeader ? (
                      <button
                        onClick={() => restartGame()}
                        className="mt-4 rounded-md bg-indigo-500 px-5 py-2 font-semibold transition-colors hover:bg-indigo-400"
                      >
                        Restart game
                      </button>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        Waiting for <span className="font-semibold">{memberName(lobby.leader)}</span> to restart…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Finished — overlaid; leader plays again or picks a new size */}
              {lobby.status === "finished" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/80 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-xs rounded-2xl bg-slate-800/95 p-6 text-center shadow-xl ring-1 ring-slate-700">
                    <p className="text-4xl">{game.winnerUid === "tie" ? "🤝" : "🏆"}</p>
                    <h2 className="mt-2 text-xl font-bold">
                      {game.winnerUid === "tie" ? "It's a tie!" : `${memberName(game.winnerUid || "")} wins!`}
                    </h2>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-sm text-slate-300">
                      {(game.turnOrder || []).map((pid, i) => (
                        <span key={pid} className={classNames("font-semibold", PALETTE[i % PALETTE.length].text)}>
                          {memberName(pid)} {game.scores?.[pid] ?? 0}
                        </span>
                      ))}
                    </div>
                    {isLeader ? (
                      <>
                        <button
                          onClick={() => startGame()}
                          className="mt-4 w-full rounded-md bg-indigo-500 px-4 py-2 font-semibold transition-colors hover:bg-indigo-400"
                        >
                          Play again ({dimension}×{dimension})
                        </button>
                        <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                          or pick a new size
                        </p>
                        <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                          {SIZES.map((d) => (
                            <button
                              key={d}
                              onClick={() => startGame(d)}
                              className={classNames(
                                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                                d === dimension
                                  ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400"
                                  : "bg-slate-900 text-slate-300 hover:text-white"
                              )}
                            >
                              {d}×{d}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-slate-300">
                        Waiting for <span className="font-semibold">{memberName(lobby.leader)}</span> to start a new game…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Chat */}
      <section className="mt-6 w-full max-w-3xl">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Chat</h2>
        <div className="mt-2 rounded-xl bg-slate-800 p-3">
          <div className="h-40 space-y-1 overflow-y-auto pr-1 text-sm">
            {chatMessages.length === 0 ? (
              <p className="text-slate-500">No messages yet. Say hi! 👋</p>
            ) : (
              chatMessages.map((m) => {
                if (m.system) {
                  return (
                    <div key={m.id} className="py-0.5 text-center text-xs italic text-slate-500">
                      {m.text}
                    </div>
                  );
                }
                const idx = order.indexOf(m.uid ?? "");
                const color = idx >= 0 ? PALETTE[idx % PALETTE.length].text : "text-slate-400";
                // Prefer the sender's current lobby nickname; fall back to the
                // name stored with the message (e.g. for players who've left).
                const sender = lobby.members?.[m.uid ?? ""]?.nickname || m.name || "Player";
                return (
                  <div key={m.id} className="break-words">
                    <span className={classNames("font-semibold", color)}>{sender}</span>
                    <span className="text-slate-500">: </span>
                    <span className="text-slate-200">{m.text}</span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={onSendChat} className="mt-2 flex gap-2">
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              maxLength={200}
              placeholder="Message…"
              className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={!chatDraft.trim()}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium transition-colors hover:bg-indigo-400 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </section>

    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 px-4 pt-24 text-slate-100">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-800 p-6 text-center">
      <p className="text-slate-300">{text}</p>
      {children}
    </div>
  );
}

function BackToMenu({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push("/")}
      className="mt-4 rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400"
    >
      Back to menu
    </button>
  );
}
