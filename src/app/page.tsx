"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import { useAppContext } from "context/AppProvider";
import { useAuth } from "context/AuthProvider";
import { createLobby } from "lib/lobby";
import { rtdbEnabled } from "lib/firebase";
import { fetchImageSets, type ImageSet } from "lib/imageSets";
import TileSetPicker from "components/TileSetPicker";
import { PALETTE } from "utils/players";

const ACCENTS = [
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-purple-600",
  "from-rose-500 to-pink-600",
];

// The three difficulty options scale up with the number of players, so more
// players get a bigger board (3-5 players go above 8x8).
function sizesFor(players: number) {
  const base = players <= 2 ? 4 : players === 3 ? 6 : 8;
  return [base, base + 2, base + 4].map((dimension, i) => ({
    dimension,
    label: ["Easy", "Medium", "Hard"][i],
    accent: ACCENTS[i],
  }));
}

export default function Home() {
  const router = useRouter();
  const { setAppState } = useAppContext();
  const [players, setPlayers] = useState<number>(1);
  const [names, setNames] = useState<string[]>(["", "", "", "", ""]);
  const { user, profile, signInGuest } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [sets, setSets] = useState<ImageSet[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [setImages, setSetImages] = useState<string[]>([]);
  const isVs = players >= 2;

  // Load selectable image sets (admin-uploaded).
  useEffect(() => {
    fetchImageSets()
      .then(setSets)
      .catch(() => setSets([]));
  }, []);

  const onSelectSets = (ids: string[]) => {
    setSelectedIds(ids);
    setSetImages(sets.filter((s) => ids.includes(s.id)).flatMap((s) => s.images.map((i) => i.url)));
  };

  const createOnline = async () => {
    setCreating(true);
    try {
      const u = user ?? (await signInGuest()); // guest is fine — no login required
      if (!u) {
        setCreating(false);
        return;
      }
      const code = await createLobby(u.uid, profile?.nickname || "Guest", 4);
      router.push(`/lobby/${code}`);
    } catch {
      setCreating(false);
    }
  };
  const joinOnline = () => {
    const c = joinCode.trim().toUpperCase();
    if (c) router.push(`/lobby/${c}`);
  };

  // Pre-fill Player 1 with the signed-in player's nickname (until they edit it).
  useEffect(() => {
    if (profile?.nickname) {
      setNames((prev) => (prev[0] ? prev : [profile.nickname, ...prev.slice(1)]));
    }
  }, [profile?.nickname]);

  const setName = (i: number, value: string) =>
    setNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  const play = (dimension: number) => {
    setAppState({ dimension, players, names: names.slice(0, players), setImages });
    router.push("/game");
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-900 px-4 py-10 text-slate-100">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          GAP<span className="text-indigo-400">pairs</span>
        </h1>
        <p className="mt-3 text-slate-400">Flip the tiles, find every matching pair.</p>

        {/* Mode toggle */}
        <div className="mt-8 inline-flex rounded-full bg-slate-800 p-1">
          <button
            onClick={() => setPlayers(1)}
            aria-pressed={!isVs}
            className={classNames(
              "rounded-full px-6 py-2 text-sm font-semibold transition-colors",
              !isVs ? "bg-indigo-500 text-white" : "text-slate-300 hover:text-white"
            )}
          >
            Solo
          </button>
          <button
            onClick={() => setPlayers((p) => (p >= 2 ? p : 2))}
            aria-pressed={isVs}
            className={classNames(
              "rounded-full px-6 py-2 text-sm font-semibold transition-colors",
              isVs ? "bg-indigo-500 text-white" : "text-slate-300 hover:text-white"
            )}
          >
            VS Mode
          </button>
        </div>

        {/* Player count (VS only) */}
        {isVs && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-slate-400">Players</span>
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setPlayers(n)}
                aria-pressed={players === n}
                className={classNames(
                  "h-9 w-9 rounded-full text-sm font-semibold transition-colors",
                  players === n
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Nicknames (VS only) */}
        {isVs && (
          <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
            {Array.from({ length: players }).map((_, i) => (
              <label
                key={i}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 ring-1 ring-slate-700 focus-within:ring-indigo-400"
              >
                <span className={classNames("h-2.5 w-2.5 shrink-0 rounded-full", PALETTE[i].dot)} />
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => setName(i, e.target.value)}
                  maxLength={16}
                  placeholder={`Player ${i + 1}`}
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                {i === 0 && profile && (
                  <span className="shrink-0 text-xs font-medium text-indigo-300">you</span>
                )}
              </label>
            ))}
          </div>
        )}

        {/* Tile set (admin-uploaded images mixed with emojis) */}
        {sets.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-500">
              Tiles <span className="font-normal normal-case tracking-normal text-slate-600">· pick one or more to mix</span>
            </p>
            <TileSetPicker sets={sets} selectedIds={selectedIds} onChange={onSelectSets} />
          </div>
        )}

        {/* Grid size — scales with player count */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {sizesFor(players).map((size) => (
            <button
              key={size.dimension}
              onClick={() => play(size.dimension)}
              className={`group flex flex-col items-center rounded-2xl bg-gradient-to-br ${size.accent} p-6 text-white shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0`}
            >
              <span className="text-2xl font-bold">{size.label}</span>
              <span className="mt-1 text-3xl font-extrabold tracking-tight">
                {size.dimension} × {size.dimension}
              </span>
              <span className="mt-2 text-sm text-white/80">
                {(size.dimension * size.dimension) / 2} pairs
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {isVs
            ? `${players} players take turns — match a pair to go again, miss and play passes on.`
            : "Find all the pairs in as few moves as you can."}
        </p>

        {/* Online multiplayer */}
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Play online with friends
          </h2>
          {!rtdbEnabled ? (
            <p className="mt-3 text-sm text-slate-500">
              Set <code>NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> to enable online lobbies.
            </p>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={createOnline}
                disabled={creating}
                className="rounded-xl bg-indigo-500 px-5 py-2.5 font-semibold transition-colors hover:bg-indigo-400 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create lobby"}
              </button>
              <div className="flex items-center gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="CODE"
                  className="w-28 rounded-md bg-slate-800 px-3 py-2 text-center font-mono tracking-widest text-slate-100 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                />
                <button
                  onClick={joinOnline}
                  disabled={!joinCode.trim()}
                  className="rounded-md bg-slate-700 px-4 py-2 font-medium transition-colors hover:bg-slate-600 disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
