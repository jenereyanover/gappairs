"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import classNames from "classnames";
import { useAuth } from "context/AuthProvider";
import { fetchSoloLeaderboard, fetchVsLeaderboard, type SoloScore, type UserProfile } from "lib/games";
import { formatTime } from "utils/players";

const DIMENSIONS = [4, 6, 8, 10, 12];

export default function LeaderboardPage() {
  const { user, loading, enabled, signIn } = useAuth();
  const [dimension, setDimension] = useState(4);
  const [solo, setSolo] = useState<SoloScore[]>([]);
  const [vs, setVs] = useState<UserProfile[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);

  useEffect(() => {
    if (!enabled || !user || user.isAnonymous) return;
    let cancelled = false;
    setLoadingBoards(true);
    Promise.all([fetchSoloLeaderboard(dimension), fetchVsLeaderboard()])
      .then(([s, v]) => {
        if (cancelled) return;
        setSolo(s);
        setVs(v);
      })
      .finally(() => !cancelled && setLoadingBoards(false));
    return () => {
      cancelled = true;
    };
  }, [enabled, user, dimension]);

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-slate-900 px-4 pb-12 pt-20 text-slate-100">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Back to menu
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">🏆 Leaderboard</h1>

        {!enabled ? (
          <p className="mt-6 rounded-lg bg-slate-800 p-4 text-slate-300">
            Leaderboards need Firebase — add your keys to <code>.env.local</code>.
          </p>
        ) : loading ? (
          <p className="mt-6 text-slate-400">Loading…</p>
        ) : !user || user.isAnonymous ? (
          <div className="mt-6 rounded-lg bg-slate-800 p-6 text-center">
            <p className="text-slate-300">Log in to view the leaderboards.</p>
            <button
              onClick={signIn}
              className="mt-4 rounded-md bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
            >
              Log in with Google
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Fastest solo times */}
            <section className="rounded-xl bg-slate-800 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Fastest solo</h2>
                <div className="flex gap-1">
                  {DIMENSIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDimension(d)}
                      className={classNames(
                        "rounded px-2 py-1 text-xs font-semibold transition-colors",
                        d === dimension ? "bg-indigo-500 text-white" : "bg-slate-900 text-slate-400 hover:text-white"
                      )}
                    >
                      {d}×{d}
                    </button>
                  ))}
                </div>
              </div>
              {loadingBoards ? (
                <p className="mt-3 text-sm text-slate-500">Loading…</p>
              ) : solo.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No times for {dimension}×{dimension} yet.</p>
              ) : (
                <ol className="mt-3 space-y-1">
                  {solo.map((s, i) => (
                    <li
                      key={s.uid}
                      className={classNames(
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                        s.uid === user.uid ? "bg-indigo-500/15 ring-1 ring-indigo-400/40" : ""
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-center">{medal(i)}</span>
                        <span className="max-w-[9rem] truncate">{s.nickname}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatTime(s.bestMs)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Most VS wins */}
            <section className="rounded-xl bg-slate-800 p-5">
              <h2 className="font-semibold">Most VS wins</h2>
              {loadingBoards ? (
                <p className="mt-3 text-sm text-slate-500">Loading…</p>
              ) : vs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No VS wins recorded yet.</p>
              ) : (
                <ol className="mt-3 space-y-1">
                  {vs.map((u, i) => (
                    <li
                      key={u.uid}
                      className={classNames(
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                        u.uid === user.uid ? "bg-indigo-500/15 ring-1 ring-indigo-400/40" : ""
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-center">{medal(i)}</span>
                        <span className="max-w-[9rem] truncate">{u.nickname}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{u.vsWins}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
