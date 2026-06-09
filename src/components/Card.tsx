"use client";

import { motion } from "framer-motion";
import classNames from "classnames";
import { cldThumb, isImageFace } from "lib/cloudinary";

interface CardProps {
  emoji: string;
  open?: boolean;
  paired?: boolean;
  disabled?: boolean;
  /** Classes for the matched (face-up & paired) tile — set per owning player. */
  matchClass?: string;
  onClick: () => void;
}

const DEFAULT_MATCH = "border-emerald-400 bg-emerald-50";

const faceStyle: React.CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

export default function Card({
  emoji,
  open,
  paired,
  disabled,
  matchClass,
  onClick,
}: CardProps) {
  const faceUp = Boolean(open || paired);

  return (
    <div className="aspect-square w-full" style={{ perspective: 700 }}>
      <motion.button
        type="button"
        aria-label={faceUp ? `tile ${emoji}` : "hidden tile"}
        disabled={disabled}
        onClick={onClick}
        className="relative h-full w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" }}
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
      >
        {/* Face down */}
        <span
          className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-white/30 bg-gradient-to-br from-indigo-500 to-purple-600 text-white/70"
          style={faceStyle}
        >
          <span style={{ fontSize: "0.45em" }}>?</span>
        </span>

        {/* Face up */}
        <span
          className={classNames(
            "absolute inset-0 flex select-none items-center justify-center rounded-xl border-2 transition-colors",
            paired ? matchClass ?? DEFAULT_MATCH : "border-slate-200 bg-white"
          )}
          style={{ ...faceStyle, transform: "rotateY(180deg)" }}
        >
          {isImageFace(emoji) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldThumb(emoji)}
              alt=""
              draggable={false}
              className="h-[78%] w-[78%] rounded-md object-cover"
              style={{ opacity: paired ? 0.85 : 1 }}
            />
          ) : (
            <span style={{ opacity: paired ? 0.85 : 1 }}>{emoji}</span>
          )}
        </span>
      </motion.button>
    </div>
  );
}
