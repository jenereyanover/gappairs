// Shared per-player helpers, used by the menu, game board, and lobby.
// Player colors live in the Arcade Neon token module.

export { PLAYER_COLORS, playerColor } from "lib/arcade";

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
