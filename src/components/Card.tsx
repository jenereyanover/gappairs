"use client";

import { cldThumb, isImageFace } from "lib/cloudinary";
import { ACCENT, ACCENT2, GRAD, hexA } from "lib/arcade";

interface CardProps {
  emoji: string;
  open?: boolean;
  paired?: boolean;
  disabled?: boolean;
  /** Hex color for a matched tile's ring/glow — the scorer's color (VS) or the accent (solo). */
  matchColor?: string;
  /** Tile corner radius in px. */
  radius?: number;
  onClick: () => void;
}

// A reveal-with-pop tile (no 3D flip) — robust across engines, matching the
// Arcade design's final game board. Face-down = neon "?" back; face-up = light
// face with the glyph/image, ringed in the scorer's color when matched.
export default function Card({ emoji, open, paired, disabled, matchColor, radius = 14, onClick }: CardProps) {
  const up = Boolean(open || paired);
  const mc = matchColor || ACCENT;

  return (
    <button
      type="button"
      aria-label={up ? `tile ${emoji}` : "hidden tile"}
      disabled={disabled}
      onClick={onClick}
      className="gb-tile outline-none focus-visible:ring-2 focus-visible:ring-[#7c83ff]"
      style={{ aspectRatio: "1", border: "none", background: "transparent", padding: 0, width: "100%", borderRadius: radius, cursor: disabled ? "default" : "pointer" }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", animation: up ? "gb-pop .26s ease" : "none" }}>
        {up ? (
          <div
            className="flex select-none items-center justify-center"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              background: paired ? hexA(mc, 0.14) : "linear-gradient(160deg,#f3f5fb,#e6e9f4)",
              boxShadow: paired ? `inset 0 0 0 2px ${mc}, 0 0 22px -6px ${mc}` : "inset 0 0 0 1px rgba(255,255,255,.5)",
              color: "#1a1f2e",
              transition: "box-shadow .2s",
            }}
          >
            {isImageFace(emoji) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cldThumb(emoji)}
                alt=""
                draggable={false}
                className="h-[80%] w-[80%] rounded-md object-cover"
                style={{ opacity: paired ? 0.9 : 1 }}
              />
            ) : (
              <span style={{ opacity: paired ? 0.92 : 1 }}>{emoji}</span>
            )}
          </div>
        ) : (
          <div
            className="font-display flex items-center justify-center font-extrabold"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              background: GRAD,
              color: "rgba(255,255,255,.92)",
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,.16), inset 0 -3px 8px ${hexA(ACCENT2, 0.4)}`,
            }}
          >
            <span style={{ fontSize: "0.5em" }}>?</span>
          </div>
        )}
      </div>
    </button>
  );
}
