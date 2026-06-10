"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "context/AppProvider";
import { useAuth } from "context/AuthProvider";
import { createLobby } from "lib/lobby";
import { rtdbEnabled } from "lib/firebase";
import { fetchImageSets, type ImageSet } from "lib/imageSets";
import { ACCENT, ACCENT2, GRAD, RADIUS, DIFFS, hexA, playerColor } from "lib/arcade";
import ArcadeBackground from "components/arcade/ArcadeBackground";
import { FlipTile, GridDots } from "components/arcade/Tiles";
import PackScroller, { buildPacks } from "components/arcade/PackScroller";

const R = RADIUS;
const acc = ACCENT;
const acc2 = ACCENT2;
const grad = GRAD;
const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".16em",
  color: "#7a83a0",
  marginBottom: 14,
};

const WALL_GLYPHS = ["🙂", "🎯", "★", "🍕", "✈️", "🌍", "🎲", "P", "⚽", "🚀", "◆", "🧭", "🎸", "A", "📸", "🎒"];
const WALL_PACKS: ("emoji" | "badge" | "travel")[] = [
  "emoji", "emoji", "badge", "emoji", "travel", "travel", "emoji", "badge",
  "emoji", "emoji", "badge", "travel", "emoji", "badge", "travel", "travel",
];

export default function Home() {
  const router = useRouter();
  const { setAppState } = useAppContext();
  const { user, profile, enabled, loading, isAdmin, signIn, signInGuest } = useAuth();

  const [sets, setSets] = useState<ImageSet[]>([]);
  const [packs, setPacks] = useState<string[]>(["emojis"]);
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("easy");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"solo" | "vs">("solo");
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"]);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchImageSets()
      .then(setSets)
      .catch(() => setSets([]));
  }, []);

  const packList = buildPacks(sets);
  const togglePack = (id: string) =>
    setPacks((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : [...p, id]));
  const setName = (i: number, v: string) => setNames((arr) => arr.map((n, j) => (j === i ? v : n)));
  const selectedImageUrls = () =>
    sets.filter((s) => packs.includes(s.id)).flatMap((s) => s.images.map((i) => i.url));

  // Close modal on Escape.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModalOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const play = () => {
    const meta = DIFFS.find((d) => d.id === diff) || DIFFS[0];
    const players = mode === "vs" ? playerCount : 1;
    setAppState({
      dimension: meta.n,
      players,
      names: names.slice(0, players),
      setImages: selectedImageUrls(),
    });
    setModalOpen(false);
    router.push("/game");
  };

  const createOnline = async () => {
    if (!rtdbEnabled || creating) return;
    setCreating(true);
    try {
      const u = user ?? (await signInGuest());
      if (!u) return setCreating(false);
      const code = await createLobby(u.uid, profile?.nickname || names[0] || "Guest", 4);
      router.push(`/lobby/${code}`);
    } catch {
      setCreating(false);
    }
  };
  const joinOnline = () => {
    const c = joinCode.trim().toUpperCase();
    if (c) router.push(`/lobby/${c}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        color: "#e8ecf6",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <ArcadeBackground />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1240,
          margin: "0 auto",
          padding: "clamp(18px, 3vw, 30px) clamp(18px, 4vw, 48px) 56px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>
            GAP<span style={{ color: acc2 }}>pairs</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/leaderboard"
              className="c-friend"
              style={{ fontSize: 14, color: "#9aa3ba", fontWeight: 600, textDecoration: "none" }}
            >
              Leaderboard
            </Link>
            <AuthControl
              enabled={enabled}
              loading={loading}
              isAdmin={isAdmin}
              loggedIn={!!user && !user.isAnonymous}
              photo={user?.photoURL || null}
              nickname={profile?.nickname || null}
              onSignIn={signIn}
            />
          </div>
        </div>

        {/* HERO */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
          <div style={{ position: "relative", padding: "clamp(28px,4vw,52px) 0", borderRadius: R + 8, overflow: "hidden" }}>
            {/* faint flip-tile wall */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 14,
                padding: 18,
                opacity: 0.08,
                perspective: 900,
                placeItems: "center",
                filter: "saturate(.6)",
              }}
            >
              {WALL_GLYPHS.map((g, i) => (
                <FlipTile key={i} pack={WALL_PACKS[i]} glyph={g} idx={i} size={74} radius={Math.max(8, R)} delay={(i % 8) * 0.5} dur={6.5} />
              ))}
            </div>
            {/* vignette (fades to transparent so the canvas flows through) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(620px 340px at 50% 50%, ${hexA("#070b15", 0.45)}, transparent 72%)`,
                zIndex: 2,
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", zIndex: 3, textAlign: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: ".18em",
                  color: acc2,
                  background: hexA(acc2, 0.12),
                  border: `1px solid ${hexA(acc2, 0.35)}`,
                  borderRadius: 999,
                  padding: "6px 14px",
                  marginBottom: 18,
                }}
              >
                🎴 MEMORY ARCADE
              </div>
              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(56px, 9vw, 96px)",
                  fontWeight: 700,
                  letterSpacing: "-.02em",
                  margin: 0,
                  lineHeight: 0.95,
                  textShadow: `0 0 40px ${hexA(acc, 0.45)}`,
                }}
              >
                GAP
                <span
                  style={{
                    background: grad,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: `drop-shadow(0 0 24px ${hexA(acc2, 0.6)})`,
                  }}
                >
                  pairs
                </span>
              </h1>
              <p style={{ color: "#aeb6c8", fontSize: "clamp(15px,1.6vw,18px)", margin: "16px 0 30px", fontWeight: 500 }}>
                Flip the tiles. Find every pair. Beat your best.
              </p>

              <button
                className="c-play"
                onClick={() => setModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  background: grad,
                  color: "#fff",
                  border: "none",
                  borderRadius: R + 2,
                  padding: "18px 56px",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: ".04em",
                  fontFamily: "var(--font-fredoka), sans-serif",
                  cursor: "pointer",
                  boxShadow: `0 0 44px -6px ${hexA(acc, 0.95)}`,
                  transition: "transform .14s, box-shadow .2s",
                }}
              >
                <span style={{ fontSize: 18 }}>▶</span> PLAY
              </button>

              {/* friends */}
              {rtdbEnabled && (
                <div style={{ marginTop: 34, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".16em", color: "#6b7488", whiteSpace: "nowrap" }}>
                      OR PLAY WITH FRIENDS
                    </span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
                  </div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <button
                      className="c-friend"
                      onClick={createOnline}
                      disabled={creating}
                      style={{
                        flex: 1,
                        background: hexA(acc2, 0.14),
                        color: "#d9bbff",
                        border: `1px solid ${hexA(acc2, 0.4)}`,
                        borderRadius: R - 4,
                        padding: 12,
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: creating ? "default" : "pointer",
                        fontFamily: "inherit",
                        opacity: creating ? 0.6 : 1,
                        transition: "all .15s",
                      }}
                    >
                      {creating ? "Creating…" : "+ Create lobby"}
                    </button>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && joinOnline()}
                      placeholder="ENTER CODE"
                      maxLength={9}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "center",
                        background: "rgba(255,255,255,.03)",
                        border: "1px dashed rgba(255,255,255,.18)",
                        borderRadius: R - 4,
                        color: "#e8ecf6",
                        fontWeight: 700,
                        letterSpacing: ".16em",
                        fontSize: 12.5,
                        fontFamily: "inherit",
                        outline: "none",
                        padding: "12px 8px",
                      }}
                    />
                    <button
                      className="c-friend"
                      onClick={joinOnline}
                      style={{
                        background: "rgba(255,255,255,.06)",
                        color: "#dfe4f0",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: R - 4,
                        padding: "12px 24px",
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all .15s",
                      }}
                    >
                      Join
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SETUP MODAL */}
      {modalOpen && (
        <div
          className="c-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(5,8,16,.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            className="c-modal-card"
            style={{
              width: "min(640px, 100%)",
              background: "linear-gradient(180deg, #0e1424, #0b101d)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: R + 6,
              padding: "clamp(22px, 3vw, 30px)",
              boxShadow: `0 40px 90px -30px rgba(0,0,0,.8), 0 0 60px -20px ${hexA(acc2, 0.5)}`,
              position: "relative",
            }}
          >
            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                  Set up your game
                </h2>
                <p style={{ fontSize: 13.5, color: "#8b94a8", margin: "4px 0 0" }}>
                  {mode === "vs" ? "Add your players, pick tiles and difficulty." : "Pick your tiles and difficulty, then play."}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="c-close"
                style={{
                  width: 36,
                  height: 36,
                  flex: "0 0 36px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.1)",
                  color: "#aeb6c8",
                  fontSize: 18,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "inherit",
                  transition: "all .15s",
                }}
              >
                ✕
              </button>
            </div>

            {/* mode */}
            <div style={sectionLabel}>MODE</div>
            <div style={{ display: "flex", gap: 9 }}>
              {([["solo", "🎮 Solo"], ["vs", "⚔️ VS Mode"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="c-mode font-display"
                  style={{
                    flex: 1,
                    border: `1.5px solid ${mode === m ? acc2 : "rgba(255,255,255,.1)"}`,
                    background: mode === m ? hexA(acc2, 0.14) : "rgba(255,255,255,.02)",
                    boxShadow: mode === m ? `0 0 0 1px ${acc2}, 0 0 26px -8px ${acc2}` : "none",
                    color: mode === m ? "#fff" : "#aeb6c8",
                    borderRadius: R - 2,
                    padding: 13,
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all .15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* VS players + names */}
            {mode === "vs" && (
              <div style={{ marginTop: 22 }}>
                <div style={{ ...sectionLabel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ whiteSpace: "nowrap" }}>PLAYERS</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPlayerCount(n)}
                        className="c-count"
                        style={{
                          width: 34,
                          height: 30,
                          borderRadius: 9,
                          border: `1.5px solid ${playerCount === n ? acc2 : "rgba(255,255,255,.12)"}`,
                          background: playerCount === n ? hexA(acc2, 0.16) : "transparent",
                          color: playerCount === n ? "#fff" : "#9aa3ba",
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all .15s",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 9 }}>
                  {names.slice(0, playerCount).map((nm, i) => (
                    <label
                      key={i}
                      className="c-namefield"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        background: "rgba(255,255,255,.03)",
                        border: `1px solid ${hexA(playerColor(i), 0.4)}`,
                        borderRadius: R - 4,
                        padding: 5,
                        transition: "border-color .15s",
                      }}
                    >
                      <span
                        className="font-display"
                        style={{
                          width: 30,
                          height: 30,
                          flex: "0 0 30px",
                          borderRadius: 8,
                          background: playerColor(i),
                          color: "#0b101d",
                          fontWeight: 800,
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: `0 0 14px -2px ${hexA(playerColor(i), 0.8)}`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <input
                        value={nm}
                        onChange={(e) => setName(i, e.target.value)}
                        placeholder={`Player ${i + 1}`}
                        maxLength={16}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          color: "#e8ecf6",
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: "inherit",
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div style={{ height: 24 }} />
              </div>
            )}

            {/* packs */}
            <div
              style={{
                ...sectionLabel,
                ...(mode === "vs" ? {} : { marginTop: 24 }),
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>TILE PACKS</span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", color: "#6b7488", whiteSpace: "nowrap" }}>
                {packs.length} selected · mix freely
              </span>
            </div>
            <PackScroller packs={packList} selectedIds={packs} onToggle={togglePack} />

            {/* difficulty */}
            <div style={{ ...sectionLabel, marginTop: 24 }}>DIFFICULTY</div>
            <div style={{ display: "flex", gap: 11 }}>
              {DIFFS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDiff(d.id)}
                  className="c-diff"
                  style={{
                    flex: 1,
                    border: `1.5px solid ${diff === d.id ? d.color : "rgba(255,255,255,.1)"}`,
                    background: diff === d.id ? `rgba(${d.tint},.14)` : "rgba(255,255,255,.02)",
                    boxShadow: diff === d.id ? `0 0 0 1.5px ${d.color}, 0 0 30px -8px ${d.color}` : "none",
                    borderRadius: R,
                    padding: "15px 10px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    fontFamily: "inherit",
                    transition: "all .15s",
                  }}
                >
                  <div style={{ padding: 8, borderRadius: 10, background: `rgba(${d.tint},${diff === d.id ? ".2" : ".08"})`, marginBottom: 12 }}>
                    <GridDots n={d.n} color={d.color} size={d.n > 6 ? 3 : 4.5} gap={d.n > 6 ? 2 : 3} dim={diff !== d.id} />
                  </div>
                  <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: diff === d.id ? "#fff" : "#cdd4e2" }}>
                    {d.label}
                  </span>
                  <span className="font-display" style={{ fontSize: 20, fontWeight: 700, color: diff === d.id ? d.color : "#8b94a8" }}>
                    {d.grid}
                  </span>
                  <span style={{ fontSize: 11.5, color: "#6b7488" }}>{d.pairs} pairs</span>
                </button>
              ))}
            </div>

            <button
              className="c-start font-display"
              onClick={play}
              style={{
                width: "100%",
                marginTop: 24,
                background: grad,
                color: "#fff",
                border: "none",
                borderRadius: R,
                padding: 16,
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: ".04em",
                cursor: "pointer",
                boxShadow: `0 0 34px -8px ${hexA(acc, 0.9)}`,
                transition: "all .15s",
              }}
            >
              ▶  PLAY NOW
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthControl({
  enabled,
  loading,
  isAdmin,
  loggedIn,
  photo,
  nickname,
  onSignIn,
}: {
  enabled: boolean;
  loading: boolean;
  isAdmin: boolean;
  loggedIn: boolean;
  photo: string | null;
  nickname: string | null;
  onSignIn: () => void;
}) {
  if (!enabled) {
    return <span style={{ fontSize: 13, color: "#6b7488" }}>Login unavailable</span>;
  }
  if (loading) {
    return <span style={{ fontSize: 14, color: "#56607a" }}>…</span>;
  }
  if (loggedIn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {isAdmin && (
          <Link href="/admin" className="c-friend" style={{ fontSize: 14, color: "#f5c542", fontWeight: 600, textDecoration: "none" }}>
            Admin
          </Link>
        )}
        <Link
          href="/profile"
          className="c-friend"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 999,
            padding: "4px 12px 4px 4px",
            textDecoration: "none",
            color: "#e8ecf6",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%" }} />
          ) : (
            <span
              className="font-display"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: ACCENT,
                color: "#0b101d",
                fontWeight: 800,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {(nickname || "?").charAt(0).toUpperCase()}
            </span>
          )}
          <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 600 }}>
            {nickname || "Profile"}
          </span>
        </Link>
      </div>
    );
  }
  return (
    <button
      onClick={onSignIn}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        color: "#1a1f2e",
        border: "none",
        borderRadius: 10,
        padding: "8px 14px",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: "conic-gradient(#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        G
      </span>
      Log in
    </button>
  );
}
