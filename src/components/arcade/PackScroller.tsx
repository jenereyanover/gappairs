"use client";

// Horizontal, arrow-navigable tile-pack selector — shared by the setup modal
// and the lobby. "Emojis" is always present; image sets toggle on/off.
import { useCallback, useEffect, useRef, useState } from "react";
import { ACCENT2, RADIUS, hexA } from "lib/arcade";
import { cldThumb } from "lib/cloudinary";
import { TileFace } from "components/arcade/Tiles";

export interface PackItem {
  id: string;
  name: string;
  kind: "emoji" | "image";
  glyphs?: string[];
  images?: { url: string }[];
}

export default function PackScroller({
  packs,
  selectedIds,
  onToggle,
  readOnly = false,
  size = "lg",
}: {
  packs: PackItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
  size?: "lg" | "sm";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setNav({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 });
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", update);
    };
  }, [update, packs.length]);
  const scroll = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const cardW = size === "lg" ? 150 : 128;
  const faceSize = size === "lg" ? 28 : 24;
  const arrowW = size === "lg" ? 36 : 30;
  const R = RADIUS;

  const arrowStyle = (on: boolean): React.CSSProperties => ({
    flex: `0 0 ${arrowW}px`,
    width: arrowW,
    borderRadius: R - 4,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
    color: "#cdd4e2",
    fontSize: size === "lg" ? 20 : 17,
    cursor: on ? "pointer" : "default",
    opacity: on ? 1 : 0.3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    transition: "all .15s",
  });

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: size === "lg" ? 8 : 7 }}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        disabled={!nav.left}
        aria-label="Scroll packs left"
        className="c-arrow"
        style={arrowStyle(nav.left)}
      >
        ‹
      </button>
      <div
        ref={ref}
        onScroll={update}
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: size === "lg" ? 11 : 10,
          overflowX: "auto",
          flex: 1,
          minWidth: 0,
          scrollSnapType: "x proximity",
          padding: size === "lg" ? "9px 2px 11px" : "8px 2px 10px",
        }}
      >
        {packs.map((p) => {
          const on = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={readOnly ? undefined : () => onToggle(p.id)}
              className={readOnly ? "" : "c-pack"}
              style={{
                flex: `0 0 ${cardW}px`,
                scrollSnapAlign: "start",
                background: "rgba(255,255,255,.03)",
                border: `1.5px solid ${on ? ACCENT2 : "rgba(255,255,255,.1)"}`,
                boxShadow: on ? `0 0 0 1px ${ACCENT2}, 0 0 26px -8px ${ACCENT2}` : "none",
                transform: on && !readOnly ? "translateY(-2px)" : "none",
                borderRadius: R - 2,
                padding: size === "lg" ? 13 : 11,
                cursor: readOnly ? "default" : "pointer",
                display: "flex",
                flexDirection: "column",
                gap: size === "lg" ? 11 : 9,
                alignItems: "flex-start",
                color: "#e8ecf6",
                fontFamily: "inherit",
                opacity: readOnly && !on ? 0.55 : 1,
                transition: "all .15s",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {p.kind === "image"
                  ? (p.images || []).slice(0, 3).map((img, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={j}
                        src={cldThumb(img.url, 96)}
                        alt=""
                        style={{ width: faceSize, height: faceSize, borderRadius: 7, objectFit: "cover" }}
                      />
                    ))
                  : (p.glyphs || []).slice(0, 3).map((g, j) => (
                      <TileFace key={j} pack="emoji" glyph={g} idx={j} size={faceSize} radius={7} flat />
                    ))}
              </div>
              <span style={{ fontSize: size === "lg" ? 13 : 12.5, fontWeight: 700 }}>{p.name}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => scroll(1)}
        disabled={!nav.right}
        aria-label="Scroll packs right"
        className="c-arrow"
        style={arrowStyle(nav.right)}
      >
        ›
      </button>
    </div>
  );
}

const EMOJI_GLYPHS = ["🙂", "🎯", "🍕", "🎲", "⚽", "🚀", "🎸", "🌮"];

/** Build the pack list from fetched image sets, with "Emojis" always first. */
export function buildPacks(sets: { id: string; name: string; images: { url: string }[] }[]): PackItem[] {
  return [
    { id: "emojis", name: "Emojis", kind: "emoji", glyphs: EMOJI_GLYPHS },
    ...sets.map((s) => ({ id: s.id, name: s.name, kind: "image" as const, images: s.images })),
  ];
}
