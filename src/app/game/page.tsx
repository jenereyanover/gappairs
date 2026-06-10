"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "components/Card";
import { useAppContext } from "context/AppProvider";
import { useAuth } from "context/AuthProvider";
import { EMOJI_SET, generateTiles, mixFaces } from "utils/helpers";
import { saveGameResult } from "lib/games";
import { isMuted, playFlip, playMatch, playWrong, setMuted } from "utils/sound";
import { formatTime, playerName, playerColor } from "utils/players";
import { ACCENT, ACCENT2, GRAD, RADIUS, SCREEN_BG, PANEL_BG, diffByN, hexA } from "lib/arcade";

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.08)",
  fontSize: 14,
};
const ctrl: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 42,
  padding: "0 18px",
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

export default function GamePage() {
  const router = useRouter();
  const { dimension, players, names, setImages } = useAppContext();
  const { user, profile, enabled } = useAuth();
  const multiplayer = players >= 2;

  const [tiles, setTiles] = useState<string[][]>([]);
  const [open, setOpen] = useState<number[][]>([]);
  const [paired, setPaired] = useState<string[]>([]);
  const [pairOwner, setPairOwner] = useState<Record<string, number>>({});
  const [scores, setScores] = useState<number[]>(() => Array(players).fill(0));
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const savedRef = useRef(false);

  const pairCount = (dimension * dimension) / 2;
  const meta = diffByN(dimension);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  const start = useCallback(() => {
    setOpen([]);
    setPaired([]);
    setPairOwner({});
    setScores(Array(players).fill(0));
    setCurrentPlayer(0);
    setMoves(0);
    setLocked(false);
    setSecs(0);
    setRunning(false);
    setPaused(false);
    setConfirmExit(false);
    savedRef.current = false;
    const pool = setImages.length ? mixFaces(setImages, pairCount) : EMOJI_SET;
    setTiles(generateTiles(dimension, pool));
  }, [dimension, players, setImages, pairCount]);

  // Deal a fresh board whenever the chosen grid size or player count changes.
  useEffect(() => {
    start();
  }, [start]);

  const handleClick = (x: number, y: number) => {
    if (locked || paused || paired.includes(tiles[x][y])) return;
    if (open.length >= 2 || open.some(([ox, oy]) => ox === x && oy === y)) return;
    if (!running) setRunning(true);
    playFlip();
    setOpen((prev) => {
      if (prev.length >= 2) return prev;
      if (prev.some(([ox, oy]) => ox === x && oy === y)) return prev;
      return [...prev, [x, y]];
    });
  };

  // Resolve a pair once two tiles are face up.
  useEffect(() => {
    if (open.length !== 2) return;
    setMoves((m) => m + 1);
    const [[ax, ay], [bx, by]] = open;
    const emoji = tiles[ax][ay];

    if (emoji === tiles[bx][by]) {
      playMatch();
      setPaired((prev) => [...prev, emoji]);
      setPairOwner((prev) => ({ ...prev, [emoji]: currentPlayer }));
      setScores((prev) => {
        const next = [...prev];
        next[currentPlayer] += 1;
        return next;
      });
      setOpen([]);
    } else {
      playWrong();
      setLocked(true);
      const timer = setTimeout(() => {
        setOpen([]);
        setLocked(false);
        if (multiplayer) setCurrentPlayer((p) => (p + 1) % players);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [open, tiles, currentPlayer, multiplayer, players]);

  const gameOver = tiles.length > 0 && paired.length === pairCount;

  // Timer: tick each second while running, frozen when paused/won.
  useEffect(() => {
    if (!running || gameOver || paused) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, gameOver, paused]);

  useEffect(() => {
    if (gameOver) setRunning(false);
  }, [gameOver]);

  // Esc toggles the exit confirm (or exits the win screen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (gameOver) router.push("/");
      else setConfirmExit((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver, router]);

  const maxScore = scores.length ? Math.max(...scores) : 0;
  const leaders = scores.map((s, i) => (s === maxScore ? i : -1)).filter((i) => i >= 0);
  const isTie = leaders.length > 1;
  const winner = leaders[0];

  // Persist the finished game once, for signed-in players.
  useEffect(() => {
    if (!gameOver || savedRef.current) return;
    if (!enabled || !user || user.isAnonymous) return;
    savedRef.current = true;
    const timeMs = secs * 1000;
    const nickname = profile?.nickname || playerName(names, 0);
    const record = multiplayer
      ? {
          mode: "vs" as const,
          dimension,
          players,
          timeMs,
          won: !isTie && winner === 0,
          winnerName: isTie ? "Tie" : playerName(names, winner),
          scores,
        }
      : { mode: "solo" as const, dimension, players: 1, timeMs, moves, won: true };
    saveGameResult(user.uid, nickname, record).catch((e) => console.error("Failed to save game", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // sizing by difficulty
  const board = dimension <= 4 ? 460 : dimension <= 6 ? 620 : 760;
  const gap = dimension <= 4 ? 12 : dimension <= 6 ? 9 : 6;
  const glyphFont =
    dimension <= 4 ? "clamp(26px, 7vmin, 46px)" : dimension <= 6 ? "clamp(17px, 4.6vmin, 32px)" : "clamp(11px, 3.2vmin, 24px)";
  const tileR = Math.max(6, Math.min(RADIUS, dimension > 6 ? 9 : 14));

  const ranking = multiplayer
    ? scores.map((s, i) => ({ i, score: s })).sort((a, b) => b.score - a.score)
    : [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: SCREEN_BG,
        color: "#e8ecf6",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "clamp(14px,2.5vw,22px) clamp(16px,4vw,40px)",
          flexWrap: "wrap",
        }}
      >
        {multiplayer ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...chip, gap: 7 }}>
              <span>⏱</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatTime(secs * 1000)}</span>
            </div>
            {Array.from({ length: players }).map((_, i) => {
              const active = i === currentPlayer && !gameOver;
              const col = playerColor(i);
              const nm = playerName(names, i);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: active ? hexA(col, 0.16) : "rgba(255,255,255,.04)",
                    border: `1.5px solid ${active ? col : "rgba(255,255,255,.08)"}`,
                    boxShadow: active ? `0 0 20px -6px ${col}` : "none",
                    transition: "all .2s",
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: col,
                      color: "#0b101d",
                      fontWeight: 800,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {(nm.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: active ? "#fff" : "#cdd4e2",
                      maxWidth: 90,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {nm}
                  </span>
                  <span className="font-display" style={{ fontWeight: 800, fontSize: 15, color: col, fontVariantNumeric: "tabular-nums" }}>
                    {scores[i]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ ...chip, gap: 7 }}>
              <span>⏱</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 15 }}>{formatTime(secs * 1000)}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#9aa3ba" }}>{meta.grid}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              Moves <span style={{ color: ACCENT2 }}>{moves}</span>
            </span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              Pairs <span style={{ color: ACCENT2 }}>{paired.length}/{pairCount}</span>
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleMute} aria-label="Toggle sound" className="gb-ctrl" style={{ ...ctrl, width: 42, padding: 0, fontSize: 17 }}>
            {muted ? "🔇" : "🔊"}
          </button>
          {!gameOver && (
            <button onClick={() => setPaused((p) => !p)} className="gb-ctrl" style={ctrl}>
              {paused ? "▶ Resume" : "❚❚ Pause"}
            </button>
          )}
          <button onClick={start} className="gb-ctrl font-display" style={{ ...ctrl, background: GRAD, color: "#fff", border: "none", fontWeight: 700 }}>
            Restart
          </button>
          <button onClick={() => setConfirmExit(true)} className="gb-ctrl" style={ctrl}>
            Exit
          </button>
        </div>
      </div>

      {/* turn banner (vs) */}
      {multiplayer && !gameOver && (
        <div style={{ textAlign: "center", padding: "2px 16px 6px", fontSize: 14, color: "#9aa3ba", fontWeight: 600 }}>
          <span style={{ color: playerColor(currentPlayer), fontWeight: 800 }}>{playerName(names, currentPlayer)}</span>
          {"’s turn"}
        </div>
      )}

      {/* board */}
      <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(10px,2vw,24px)", minHeight: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${dimension}, 1fr)`,
            gap,
            width: `min(92vw, 86vh, ${board}px)`,
            fontSize: glyphFont,
          }}
        >
          {tiles.map((row, x) =>
            row.map((emoji, y) => {
              const isPaired = paired.includes(emoji);
              const isOpen = open.some(([ox, oy]) => ox === x && oy === y);
              const owner = pairOwner[emoji];
              const matchColor = multiplayer && owner !== undefined ? playerColor(owner) : ACCENT;
              return (
                <Card
                  key={`${x}-${y}`}
                  emoji={emoji}
                  open={isOpen}
                  paired={isPaired}
                  matchColor={matchColor}
                  radius={tileR}
                  disabled={locked || paused || isOpen || isPaired}
                  onClick={() => handleClick(x, y)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* win overlay */}
      {gameOver && (
        <div
          className="c-modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 95,
            background: "rgba(5,8,16,.74)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="c-modal-card"
            style={{
              width: "min(440px, 100%)",
              background: PANEL_BG,
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: RADIUS + 6,
              padding: "clamp(24px,4vw,34px)",
              textAlign: "center",
              boxShadow: `0 40px 90px -30px rgba(0,0,0,.8), 0 0 60px -20px ${hexA(ACCENT2, 0.5)}`,
            }}
          >
            <div style={{ fontSize: 42, marginBottom: 8 }}>🎉</div>
            {multiplayer ? (
              <>
                <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>
                  {isTie ? "It’s a tie!" : `${playerName(names, winner)} wins!`}
                </h2>
                <p style={{ color: "#8b94a8", fontSize: 13.5, margin: "0 0 18px" }}>
                  {formatTime(secs * 1000)} · {moves} moves
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22, textAlign: "left" }}>
                  {ranking.map((r, idx) => {
                    const col = playerColor(r.i);
                    const top = r.score === maxScore;
                    return (
                      <div
                        key={r.i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          padding: "9px 12px",
                          borderRadius: RADIUS - 4,
                          background: top ? hexA(col, 0.14) : "rgba(255,255,255,.03)",
                          border: `1px solid ${top ? hexA(col, 0.5) : "rgba(255,255,255,.07)"}`,
                        }}
                      >
                        <span style={{ width: 20, color: idx === 0 ? "#f5c542" : "#6b7488", fontWeight: 800, fontSize: 13 }}>#{idx + 1}</span>
                        <span
                          className="font-display"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: col,
                            color: "#0b101d",
                            fontWeight: 800,
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {(playerName(names, r.i).trim().charAt(0) || "?").toUpperCase()}
                        </span>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {playerName(names, r.i)}
                        </span>
                        <span className="font-display" style={{ fontWeight: 800, fontSize: 17, color: col }}>{r.score}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display" style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px" }}>Solved!</h2>
                <div style={{ display: "flex", justifyContent: "center", gap: 26, margin: "14px 0 24px" }}>
                  <div>
                    <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: ACCENT2 }}>{formatTime(secs * 1000)}</div>
                    <div style={{ fontSize: 12, color: "#8b94a8", textTransform: "uppercase", letterSpacing: ".1em" }}>Time</div>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: ACCENT2 }}>{moves}</div>
                    <div style={{ fontSize: 12, color: "#8b94a8", textTransform: "uppercase", letterSpacing: ".1em" }}>Moves</div>
                  </div>
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => router.push("/")}
                className="c-friend"
                style={{ flex: 1, background: "rgba(255,255,255,.06)", color: "#dfe4f0", border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS - 4, padding: 14, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}
              >
                Menu
              </button>
              <button
                onClick={start}
                className="c-start font-display"
                style={{ flex: 1, background: GRAD, color: "#fff", border: "none", borderRadius: RADIUS - 4, padding: 14, fontWeight: 800, fontSize: 14.5, cursor: "pointer", boxShadow: `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}
              >
                Play again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* pause overlay */}
      {paused && !gameOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 96,
            background: "rgba(7,11,21,.82)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 52 }}>⏸</div>
          <div>
            <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: ".02em" }}>Paused</h2>
            <p style={{ fontSize: 14, color: "#9aa3ba", margin: "6px 0 0" }}>The board is hidden while paused.</p>
          </div>
          <button
            onClick={() => setPaused(false)}
            className="c-start font-display"
            style={{ background: GRAD, color: "#fff", border: "none", borderRadius: RADIUS, padding: "15px 40px", fontWeight: 800, fontSize: 17, letterSpacing: ".04em", cursor: "pointer", boxShadow: `0 0 34px -8px ${hexA(ACCENT, 0.9)}` }}
          >
            ▶ Resume
          </button>
        </div>
      )}

      {/* exit confirmation */}
      {confirmExit && !gameOver && (
        <div
          className="c-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setConfirmExit(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 115,
            background: "rgba(5,8,16,.74)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="c-modal-card"
            style={{ width: "min(380px, 100%)", background: PANEL_BG, border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS + 6, padding: "clamp(22px,4vw,28px)", textAlign: "center", boxShadow: "0 40px 90px -30px rgba(0,0,0,.8)" }}
          >
            <div style={{ fontSize: 32, marginBottom: 6 }}>🚪</div>
            <h2 className="font-display" style={{ fontSize: 21, fontWeight: 700, margin: "0 0 6px" }}>Quit this game?</h2>
            <p style={{ fontSize: 13.5, color: "#8b94a8", margin: "0 0 22px", lineHeight: 1.5 }}>Your current progress will be lost.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmExit(false)}
                className="c-friend"
                style={{ flex: 1, background: "rgba(255,255,255,.06)", color: "#dfe4f0", border: "1px solid rgba(255,255,255,.1)", borderRadius: RADIUS - 4, padding: 13, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Keep playing
              </button>
              <button
                onClick={() => router.push("/")}
                className="gb-ctrl"
                style={{ flex: 1, background: "rgba(244,63,94,.16)", color: "#ff7a8f", border: "1px solid rgba(244,63,94,.4)", borderRadius: RADIUS - 4, padding: 13, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
