"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "context/AuthProvider";
import { fetchSoloLeaderboard, fetchVsLeaderboard, type SoloScore, type UserProfile } from "lib/games";
import { formatTime } from "utils/players";
import { ACCENT, ACCENT2, GRAD, RADIUS, SCREEN_BG, DIFFS, hexA } from "lib/arcade";

const R = RADIUS;
const MEDALS = ["🥇", "🥈", "🥉"];

function LbRow({ rank, name, you, right }: { rank: number; name: string; you?: boolean; right: string }) {
  const medalColor = ["#f5c542", "#cfd6e4", "#d08a4e"][rank - 1];
  return (
    <div
      className="lb-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: R - 3,
        background: you ? hexA(ACCENT, 0.12) : "rgba(255,255,255,.025)",
        border: `1px solid ${you ? hexA(ACCENT, 0.5) : "rgba(255,255,255,.06)"}`,
      }}
    >
      <span style={{ width: 28, flex: "0 0 28px", textAlign: "center", fontSize: rank <= 3 ? 18 : 14, fontWeight: 700, color: rank <= 3 ? medalColor : "#6b7488", fontVariantNumeric: "tabular-nums" }}>
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: you ? 800 : 600, fontSize: 15, color: you ? ACCENT2 : "#dfe4f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
        {you && <span style={{ color: "#6b7488", fontWeight: 600, fontSize: 13 }}> · you</span>}
      </span>
      <span className="font-display" style={{ fontWeight: 800, fontSize: 16, color: you ? ACCENT2 : "#fff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {right}
      </span>
    </div>
  );
}

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

  const card: React.CSSProperties = {
    background: "rgba(17,24,40,.6)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: R + 6,
    padding: "clamp(18px,2.5vw,26px)",
  };
  const cardTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, margin: 0, whiteSpace: "nowrap" };
  const activeDiff = DIFFS.find((d) => d.n === dimension) || DIFFS[0];

  return (
    <div style={{ minHeight: "100vh", background: SCREEN_BG, color: "#e8ecf6", overflowY: "auto" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(20px,4vw,40px) clamp(18px,4vw,40px) 60px" }}>
        <Link href="/" className="lb-back" style={{ color: "#9aa3ba", fontSize: 15, fontWeight: 600, textDecoration: "none", padding: "4px 0", display: "inline-flex", alignItems: "center", gap: 8 }}>
          ← Back to menu
        </Link>
        <h1 className="font-display" style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "clamp(30px,5vw,44px)", fontWeight: 700, letterSpacing: "-.01em", margin: "14px 0 28px" }}>
          <span>🏆</span> Leaderboard
        </h1>

        {!enabled ? (
          <Panel>Leaderboards need Firebase — add your keys to <code>.env.local</code>.</Panel>
        ) : loading ? (
          <Panel>Loading…</Panel>
        ) : !user || user.isAnonymous ? (
          <Panel>
            <p style={{ margin: "0 0 14px", color: "#cdd4e2" }}>Log in to view the leaderboards.</p>
            <button onClick={signIn} className="c-start font-display" style={{ background: GRAD, color: "#fff", border: "none", borderRadius: R - 2, padding: "12px 22px", fontWeight: 800, fontSize: 14.5, cursor: "pointer", boxShadow: `0 0 30px -8px ${hexA(ACCENT, 0.9)}` }}>
              Log in with Google
            </button>
          </Panel>
        ) : (
          <div className="lb-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
            {/* Fastest solo */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                <h2 className="font-display" style={cardTitle}>Fastest solo</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DIFFS.map((d) => {
                    const on = d.n === dimension;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setDimension(d.n)}
                        className="lb-tab"
                        style={{ padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${on ? ACCENT : "rgba(255,255,255,.1)"}`, background: on ? GRAD : "rgba(255,255,255,.04)", color: on ? "#fff" : "#9aa3ba", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: on ? `0 0 20px -6px ${hexA(ACCENT, 0.9)}` : "none", transition: "all .15s" }}
                      >
                        {d.grid}
                      </button>
                    );
                  })}
                </div>
              </div>
              {loadingBoards ? (
                <p style={{ fontSize: 13.5, color: "#6b7488" }}>Loading…</p>
              ) : solo.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "#6b7488" }}>No times for {activeDiff.grid} yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {solo.map((s, i) => (
                    <LbRow key={s.uid} rank={i + 1} name={s.nickname} you={s.uid === user?.uid} right={formatTime(s.bestMs)} />
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#6b7488", marginTop: 14, textAlign: "center" }}>{activeDiff.label} · best completion times</div>
            </div>

            {/* Most VS wins */}
            <div style={card}>
              <h2 className="font-display" style={{ ...cardTitle, marginBottom: 18 }}>Most VS wins</h2>
              {loadingBoards ? (
                <p style={{ fontSize: 13.5, color: "#6b7488" }}>Loading…</p>
              ) : vs.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "#6b7488" }}>No VS wins recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {vs.map((u, i) => (
                    <LbRow key={u.uid} rank={i + 1} name={u.nickname} you={u.uid === user?.uid} right={`${u.vsWins} ${u.vsWins === 1 ? "win" : "wins"}`} />
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#6b7488", marginTop: 14, textAlign: "center" }}>all-time head-to-head victories</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@media (max-width: 720px) { .lb-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(17,24,40,.6)", border: "1px solid rgba(255,255,255,.08)", borderRadius: RADIUS + 4, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}
