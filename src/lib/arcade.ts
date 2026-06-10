// Arcade Neon design tokens — the shared visual language for GAPpairs.
// Ported from the Claude Design "GAPpairs Arcade" handoff (shared.jsx / app-c.jsx).
// Hard-coded defaults: space background, indigo→violet accent, 16px radius, no scanlines.

export const ACCENT = "#7c83ff"; // indigo
export const ACCENT2 = "#a855f7"; // violet
export const GRAD = `linear-gradient(120deg, ${ACCENT}, ${ACCENT2})`;
export const RADIUS = 16; // corner radius (R)

// Page canvas
export const BG_BASE = "#070b15";
// Game / leaderboard screens use a softer top-lit radial.
export const SCREEN_BG = "radial-gradient(1000px 620px at 50% -12%, #141d33, #0a0f1c 62%)";
export const PANEL_BG = "linear-gradient(180deg, #0e1424, #0b101d)";

// Auto-assigned per-player colors (VS mode): indigo, gold, cyan, pink, lime
export const PLAYER_COLORS = ["#7c83ff", "#f5c542", "#22d3ee", "#f472b6", "#a3e635"];
export const playerColor = (i: number) => PLAYER_COLORS[i % PLAYER_COLORS.length];

export interface Difficulty {
  id: "easy" | "medium" | "hard";
  label: string;
  grid: string; // e.g. "4×4"
  n: number; // board dimension
  pairs: number;
  color: string; // accent hex
  tint: string; // "r,g,b" for rgba()
}

export const DIFFS: Difficulty[] = [
  { id: "easy", label: "Easy", grid: "4×4", n: 4, pairs: 8, color: "#10b981", tint: "16,185,129" },
  { id: "medium", label: "Medium", grid: "6×6", n: 6, pairs: 18, color: "#8b5cf6", tint: "139,92,246" },
  { id: "hard", label: "Hard", grid: "8×8", n: 8, pairs: 32, color: "#f43f5e", tint: "244,63,94" },
];

export const diffByN = (n: number): Difficulty => DIFFS.find((d) => d.n === n) || DIFFS[0];
export const diffById = (id: string): Difficulty => DIFFS.find((d) => d.id === id) || DIFFS[0];

/** hex (#rgb/#rrggbb) + alpha (0..1) → rgba() string. */
export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
