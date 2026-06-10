// Presentational Arcade Neon tile pieces — ported from the design's shared.jsx.
// Used by the hero flip-wall, the pack previews, and the difficulty cards.
import { ACCENT, ACCENT2 } from "lib/arcade";

const BADGE_COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ec4899", "#06b6d4", "#ef4444", "#8b5cf6", "#84cc16"];

type FaceKind = "emoji" | "badge" | "travel";

export function TileFace({
  pack,
  glyph,
  idx = 0,
  size = 56,
  radius = 14,
  flat = false,
}: {
  pack: FaceKind;
  glyph: string;
  idx?: number;
  size?: number;
  radius?: number;
  flat?: boolean;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.5,
    lineHeight: 1,
    userSelect: "none",
    overflow: "hidden",
  };
  if (pack === "badge") {
    const c = BADGE_COLORS[idx % BADGE_COLORS.length];
    return (
      <div
        style={{
          ...base,
          background: `radial-gradient(circle at 35% 30%, ${c}, ${c}cc)`,
          color: "#fff",
          fontWeight: 700,
          fontFamily: "var(--font-space), sans-serif",
          fontSize: size * 0.42,
          boxShadow: flat ? "none" : "inset 0 -2px 6px rgba(0,0,0,.25), 0 0 0 2px rgba(255,255,255,.12)",
        }}
      >
        {glyph}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        background: flat ? "rgba(255,255,255,.05)" : "linear-gradient(155deg,#1c2740,#141d31)",
        boxShadow: flat ? "none" : "inset 0 1px 0 rgba(255,255,255,.06)",
      }}
    >
      {glyph}
    </div>
  );
}

export function TileBack({ size = 56, radius = 14 }: { size?: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
      }}
    >
      <div
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: 6,
          border: "2px solid rgba(255,255,255,.55)",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

/** Auto-flipping 3D tile for the hero wall. Loops with a per-tile delay. */
export function FlipTile({
  pack,
  glyph,
  idx = 0,
  size = 56,
  radius = 14,
  delay = 0,
  dur = 5.5,
}: {
  pack: FaceKind;
  glyph: string;
  idx?: number;
  size?: number;
  radius?: number;
  delay?: number;
  dur?: number;
}) {
  return (
    <div
      className="gp-flip-tile"
      style={{
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        position: "relative",
        animation: `gp-flip ${dur}s ${delay}s ease-in-out infinite`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
        <TileBack size={size} radius={radius} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        <TileFace pack={pack} glyph={glyph} idx={idx} size={size} radius={radius} />
      </div>
    </div>
  );
}

/** Mini n×n grid-of-dots preview for difficulty cards. */
export function GridDots({
  n,
  color,
  size = 4,
  gap = 3,
  dim = false,
}: {
  n: number;
  color: string;
  size?: number;
  gap?: number;
  dim?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, ${size}px)`, gap, justifyContent: "center" }}>
      {Array.from({ length: n * n }).map((_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: Math.max(1, size / 3),
            background: color,
            opacity: dim ? 0.28 : 0.9,
          }}
        />
      ))}
    </div>
  );
}
