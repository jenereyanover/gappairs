"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "context/AuthProvider";
import { fetchPlayerSoloBests, fetchUserGames, type GameRecord, type SoloScore } from "lib/games";
import { formatTime } from "utils/players";

function gameSummary(g: GameRecord): string {
  const size = `${g.dimension}×${g.dimension}`;
  if (g.mode === "solo") return `Solo ${size} · ${g.moves ?? "—"} moves · ${formatTime(g.timeMs)}`;
  const outcome = g.won ? "you won" : `${g.winnerName ?? "—"} won`;
  return `VS ${size} · ${g.players}p · ${outcome} · ${formatTime(g.timeMs)}`;
}

export default function ProfilePage() {
  const { user, profile, loading, enabled, signIn, saveNickname } = useAuth();
  const [nick, setNick] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bests, setBests] = useState<SoloScore[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (profile) setNick(profile.nickname);
  }, [profile]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let cancelled = false;
    setLoadingData(true);
    Promise.all([fetchPlayerSoloBests(user.uid), fetchUserGames(user.uid, 20)])
      .then(([b, g]) => {
        if (cancelled) return;
        setBests(b);
        setGames(g);
      })
      .finally(() => !cancelled && setLoadingData(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSave = async () => {
    setSaving(true);
    setSaved(false);
    await saveNickname(nick);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 px-4 pb-12 pt-20 text-slate-100">
      <div className="w-full max-w-xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Back to menu
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Profile</h1>

        {!enabled ? (
          <p className="mt-6 rounded-lg bg-slate-800 p-4 text-slate-300">
            Login isn’t configured. Add your Firebase keys to <code>.env.local</code>.
          </p>
        ) : loading ? (
          <p className="mt-6 text-slate-400">Loading…</p>
        ) : !user || user.isAnonymous ? (
          <div className="mt-6 rounded-lg bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Log in to set a nickname and track your games.</p>
            <button
              onClick={signIn}
              className="mt-4 rounded-md bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
            >
              Log in with Google
            </button>
          </div>
        ) : (
          <>
            {/* Nickname / IGN */}
            <section className="mt-6 rounded-xl bg-slate-800 p-5">
              <label htmlFor="nick" className="text-sm font-semibold text-slate-300">
                Nickname / IGN
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="nick"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  maxLength={16}
                  placeholder="Your in-game name"
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-slate-100 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                />
                <button
                  onClick={onSave}
                  disabled={saving || !nick.trim() || nick.trim() === profile?.nickname}
                  className="rounded-md bg-indigo-500 px-4 py-2 font-medium transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Used on the leaderboard and as Player 1 in VS Mode.
              </p>
            </section>

            {/* Stats */}
            <section className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Games", value: profile?.gamesPlayed ?? 0 },
                { label: "VS wins", value: profile?.vsWins ?? 0 },
                { label: "VS games", value: profile?.vsGames ?? 0 },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-slate-800 p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">{s.label}</div>
                </div>
              ))}
            </section>

            {/* Best solo times */}
            <section className="mt-4 rounded-xl bg-slate-800 p-5">
              <h2 className="text-sm font-semibold text-slate-300">Best solo times</h2>
              {bests.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No solo games cleared yet.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {bests.map((b) => (
                    <span key={b.dimension} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm">
                      <span className="text-slate-400">
                        {b.dimension}×{b.dimension}
                      </span>{" "}
                      <span className="font-semibold tabular-nums">{formatTime(b.bestMs)}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* History */}
            <section className="mt-4 rounded-xl bg-slate-800 p-5">
              <h2 className="text-sm font-semibold text-slate-300">Recent games</h2>
              {loadingData ? (
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              ) : games.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No games yet — go play one!</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-700/60">
                  {games.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
                      <span
                        className={
                          g.mode === "solo"
                            ? "rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300"
                            : "rounded bg-indigo-500/20 px-1.5 py-0.5 text-xs font-semibold text-indigo-300"
                        }
                      >
                        {g.mode === "solo" ? "SOLO" : "VS"}
                      </span>
                      <span className="text-slate-300">{gameSummary(g)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
