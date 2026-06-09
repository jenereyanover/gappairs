// Shared per-player styling + small helpers, used by the menu and the game.
// Class strings are literal so Tailwind's JIT keeps them even when looked up.

export interface PlayerStyle {
  tint: string;
  dot: string; // small status dot
  text: string; // coloured text
  chipActive: string; // active scoreboard chip
  banner: string; // turn banner background/ring/text
  match: string; // matched tile face (border + fill + glow)
  ring: string; // board glow for the active player
}

export const PALETTE: PlayerStyle[] = [
  {
    tint: "p1",
    dot: "bg-indigo-400",
    text: "text-indigo-300",
    chipActive: "bg-indigo-500/25 text-indigo-100 ring-indigo-400",
    banner: "bg-indigo-500/20 ring-indigo-400 text-indigo-100",
    match: "border-indigo-500 bg-indigo-200 ring-2 ring-indigo-400/60",
    ring: "ring-indigo-400/50",
  },
  {
    tint: "p2",
    dot: "bg-amber-400",
    text: "text-amber-300",
    chipActive: "bg-amber-500/25 text-amber-100 ring-amber-400",
    banner: "bg-amber-500/20 ring-amber-400 text-amber-100",
    match: "border-amber-500 bg-amber-200 ring-2 ring-amber-400/60",
    ring: "ring-amber-400/50",
  },
  {
    tint: "p3",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    chipActive: "bg-emerald-500/25 text-emerald-100 ring-emerald-400",
    banner: "bg-emerald-500/20 ring-emerald-400 text-emerald-100",
    match: "border-emerald-500 bg-emerald-200 ring-2 ring-emerald-400/60",
    ring: "ring-emerald-400/50",
  },
  {
    tint: "p4",
    dot: "bg-rose-400",
    text: "text-rose-300",
    chipActive: "bg-rose-500/25 text-rose-100 ring-rose-400",
    banner: "bg-rose-500/20 ring-rose-400 text-rose-100",
    match: "border-rose-500 bg-rose-200 ring-2 ring-rose-400/60",
    ring: "ring-rose-400/50",
  },
  {
    tint: "p5",
    dot: "bg-sky-400",
    text: "text-sky-300",
    chipActive: "bg-sky-500/25 text-sky-100 ring-sky-400",
    banner: "bg-sky-500/20 ring-sky-400 text-sky-100",
    match: "border-sky-500 bg-sky-200 ring-2 ring-sky-400/60",
    ring: "ring-sky-400/50",
  },
];

/** A player's display name, falling back to "Player N" when no nickname is set. */
export function playerName(names: string[] | undefined, index: number): string {
  const n = names?.[index]?.trim();
  return n ? n : `Player ${index + 1}`;
}

/** Format milliseconds as m:ss. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
