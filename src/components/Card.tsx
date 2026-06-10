"use client";

import { motion } from "framer-motion";
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

// A 3D flip tile. rotateY gives the flip motion; opacity (swapped at the flip's
// midpoint) decides which face shows — so the right face is always visible even
// where backface-visibility culling is unreliable. Sizing is inline (square via
// aspect-ratio + an absolutely-positioned button) so it never collapses.
const FLIP = 0.3;
const faceBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

export default function Card({ emoji, open, paired, disabled, matchColor, radius = 14, onClick }: CardProps) {
  const up = Boolean(open || paired);
  const mc = matchColor || ACCENT;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", perspective: 700 }}>
      <motion.button
        type="button"
        aria-label={up ? `tile ${emoji}` : "hidden tile"}
        disabled={disabled}
        onClick={onClick}
        className="gb-tile outline-none focus-visible:ring-2 focus-visible:ring-[#7c83ff]"
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: disabled ? "default" : "pointer",
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          borderRadius: radius,
        }}
        animate={{ rotateY: up ? 180 : 0 }}
        transition={{ duration: FLIP, ease: "easeInOut" }}
        whileTap={disabled ? undefined : { scale: 0.94 }}
      >
        {/* Face down — neon gradient "?" */}
        <span
          className="font-display font-extrabold"
          style={{
            ...faceBase,
            borderRadius: radius,
            background: GRAD,
            color: "rgba(255,255,255,.92)",
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,.16), inset 0 -3px 8px ${hexA(ACCENT2, 0.4)}`,
            opacity: up ? 0 : 1,
            transition: `opacity 0s linear ${FLIP / 2}s`,
          }}
        >
          <span style={{ fontSize: "0.5em" }}>?</span>
        </span>

        {/* Face up — light face with the glyph (or image); pre-rotated so it reads correctly */}
        <span
          className="select-none"
          style={{
            ...faceBase,
            transform: "rotateY(180deg)",
            borderRadius: radius,
            background: paired ? hexA(mc, 0.14) : "linear-gradient(160deg,#f3f5fb,#e6e9f4)",
            boxShadow: paired ? `inset 0 0 0 2px ${mc}, 0 0 22px -6px ${mc}` : "inset 0 0 0 1px rgba(255,255,255,.5)",
            color: "#1a1f2e",
            opacity: up ? 1 : 0,
            transition: `opacity 0s linear ${FLIP / 2}s, box-shadow .2s`,
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
        </span>
      </motion.button>
    </div>
  );
}
