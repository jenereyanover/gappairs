"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import { motion } from "framer-motion";
import Card from "components/Card";
import { useAppContext } from "context/AppProvider";
import { useAuth } from "context/AuthProvider";
import { EMOJI_SET, generateTiles, mixFaces } from "utils/helpers";
import { saveGameResult } from "lib/games";
import { isMuted, playFlip, playMatch, playWrong, setMuted } from "utils/sound";
import { PALETTE, formatTime, playerName } from "utils/players";

function PlayerChip({
  index,
  name,
  score,
  active,
}: {
  index: number;
  name: string;
  score: number;
  active: boolean;
}) {
  const c = PALETTE[index];
  return (
    <motion.div
      animate={{ scale: active ? 1.07 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={classNames(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-2 transition-colors",
        active ? c.chipActive : "text-slate-400 ring-transparent"
      )}
    >
      <span className={classNames("h-2.5 w-2.5 rounded-full", c.dot)} />
      <span className="max-w-[8rem] truncate">{name}</span>
      <span className="tabular-nums">{score}</span>
    </motion.div>
  );
}

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
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const savedRef = useRef(false);

  const pairCount = (dimension * dimension) / 2;

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
    setConfirmRestart(false);
    setStartedAt(null);
    setEndedAt(null);
    savedRef.current = false;
    const pool = setImages.length ? mixFaces(setImages, pairCount) : EMOJI_SET;
    setTiles(generateTiles(dimension, pool));
  }, [dimension, players, setImages, pairCount]);

  // Deal a fresh board whenever the chosen grid size or player count changes.
  useEffect(() => {
    start();
  }, [start]);

  const handleClick = (x: number, y: number) => {
    if (locked || paired.includes(tiles[x][y])) return;
    if (open.length >= 2 || open.some(([ox, oy]) => ox === x && oy === y)) return;
    if (startedAt === null) setStartedAt(Date.now()); // start the clock on the first flip
    playFlip();
    // Guard again inside the updater so the 2-tile cap and "already open"
    // check still hold if two clicks land in one render.
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
      // Match: current player scores and keeps the turn.
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
      // Miss: flip back, and in VS mode pass play to the next player.
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

  // Timer: tick while running, freeze the elapsed time on game over.
  useEffect(() => {
    if (startedAt === null || endedAt !== null) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [startedAt, endedAt]);

  useEffect(() => {
    if (gameOver && startedAt !== null && endedAt === null) setEndedAt(Date.now());
  }, [gameOver, startedAt, endedAt]);

  const elapsedMs = startedAt === null ? 0 : (endedAt ?? Date.now()) - startedAt;
  const elapsed = formatTime(elapsedMs);

  const maxScore = scores.length ? Math.max(...scores) : 0;
  const leaders = scores.map((s, i) => (s === maxScore ? i : -1)).filter((i) => i >= 0);
  const isTie = leaders.length > 1;
  const winner = leaders[0];

  // Persist the finished game once, for signed-in players.
  useEffect(() => {
    if (!gameOver || endedAt === null || savedRef.current) return;
    if (!enabled || !user || user.isAnonymous) return;
    savedRef.current = true;
    const timeMs = endedAt - (startedAt ?? endedAt);
    const nickname = profile?.nickname || playerName(names, 0);
    const record = multiplayer
      ? {
          mode: "vs" as const,
          dimension,
          players,
          timeMs,
          won: !isTie && winner === 0, // the signed-in player is Player 1
          winnerName: isTie ? "Tie" : playerName(names, winner),
          scores,
        }
      : { mode: "solo" as const, dimension, players: 1, timeMs, moves, won: true };
    saveGameResult(user.uid, nickname, record).catch((e) => console.error("Failed to save game", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, endedAt, enabled, user]);

  const handleRestart = () => {
    // Only ask for confirmation once the game is actually under way.
    if (startedAt !== null && !gameOver) setConfirmRestart(true);
    else start();
  };

  const boardWidth = `min(94vw, ${dimension >= 10 ? 46 : 34}rem)`;
  const tileFont = `calc(${boardWidth} / ${dimension} * 0.5)`;
  const tileGap = `calc(${boardWidth} / ${dimension} * 0.08)`;

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 text-slate-100">
      <header className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-sm font-semibold tabular-nums">
            ⏱ {elapsed}
          </span>
          {!multiplayer && (
            <>
              <span className="text-sm uppercase tracking-wide text-slate-400">
                {dimension} × {dimension}
              </span>
              <span className="text-sm font-semibold">
                Moves <span className="tabular-nums">{moves}</span>
              </span>
              <span className="text-sm font-semibold">
                Pairs{" "}
                <span className="tabular-nums">
                  {paired.length}/{pairCount}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm transition-colors hover:bg-slate-600 active:bg-slate-800"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            aria-pressed={muted}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-indigo-400 active:bg-indigo-600"
            onClick={handleRestart}
          >
            Restart
          </button>
          <button
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-600 active:bg-slate-800"
            onClick={() => router.push("/")}
          >
            Menu
          </button>
        </div>
      </header>

      {multiplayer && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-3 px-4 pb-1">
          <div className="flex flex-wrap justify-center gap-2">
            {scores.map((s, i) => (
              <PlayerChip
                key={i}
                index={i}
                name={playerName(names, i)}
                score={s}
                active={currentPlayer === i && !gameOver}
              />
            ))}
          </div>
          {!gameOver && (
            <motion.div
              key={currentPlayer}
              initial={{ scale: 0.85, opacity: 0, y: -4 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className={classNames(
                "flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold ring-2",
                PALETTE[currentPlayer].banner
              )}
            >
              <motion.span
                className={classNames("h-3 w-3 rounded-full", PALETTE[currentPlayer].dot)}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.3 }}
              />
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest opacity-70">
                Turn
              </span>
              <span>{playerName(names, currentPlayer)}</span>
            </motion.div>
          )}
        </div>
      )}

      <div className="flex flex-1 items-center justify-center p-4">
        <div
          className={classNames(
            "rounded-2xl p-2 ring-2 transition-colors duration-300",
            multiplayer && !gameOver ? PALETTE[currentPlayer].ring : "ring-transparent"
          )}
        >
          <div
            style={{
              width: boardWidth,
              fontSize: tileFont,
              gap: tileGap,
              display: "grid",
              gridTemplateColumns: `repeat(${dimension}, minmax(0, 1fr))`,
            }}
          >
            {tiles.map((row, x) =>
              row.map((emoji, y) => {
                const isPaired = paired.includes(emoji);
                const isOpen = open.some(([ox, oy]) => ox === x && oy === y);
                const owner = pairOwner[emoji];
                const matchClass =
                  multiplayer && owner !== undefined ? PALETTE[owner].match : undefined;
                return (
                  <Card
                    key={`${x}-${y}`}
                    emoji={emoji}
                    open={isOpen}
                    paired={isPaired}
                    matchClass={matchClass}
                    disabled={locked || isOpen || isPaired}
                    onClick={() => handleClick(x, y)}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-8 text-center shadow-xl">
            <p className="text-5xl">{!multiplayer ? "🎉" : isTie ? "🤝" : "🏆"}</p>
            <h2 className="mt-3 text-2xl font-bold">
              {!multiplayer ? (
                "You win!"
              ) : isTie ? (
                "It's a tie!"
              ) : (
                <span className={PALETTE[winner].text}>{playerName(names, winner)} wins!</span>
              )}
            </h2>
            {!multiplayer ? (
              <p className="mt-1 text-slate-300">
                Cleared the {dimension} × {dimension} board in{" "}
                <span className="font-semibold">{moves}</span> moves.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-slate-300">
                {scores.map((s, i) => (
                  <span key={i} className={classNames("font-semibold", PALETTE[i].text)}>
                    {playerName(names, i)} {s}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-sm text-slate-400">
              ⏱ Finished in{" "}
              <span className="font-semibold tabular-nums text-slate-200">{elapsed}</span>
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="rounded-md bg-indigo-500 px-4 py-2 font-medium transition-colors hover:bg-indigo-400"
                onClick={start}
              >
                Play again
              </button>
              <button
                className="rounded-md bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600"
                onClick={() => router.push("/")}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRestart && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmRestart(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold">Restart game?</h2>
            <p className="mt-2 text-slate-300">Your current progress will be lost.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="rounded-md bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600"
                onClick={() => setConfirmRestart(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-500 px-4 py-2 font-medium transition-colors hover:bg-rose-400"
                onClick={() => {
                  setConfirmRestart(false);
                  start();
                }}
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
