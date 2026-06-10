// Arcade CRT scanlines — a fixed, non-interactive overlay of faint horizontal
// lines that multiply over the whole screen for a retro-arcade texture.
// Ported from the design's Tweaks "CRT scanlines" toggle (always on here).
export default function CrtScanlines() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 200,
        mixBlendMode: "multiply",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0px, rgba(0,0,0,.16) 1px, transparent 1px, transparent 3px)",
      }}
    />
  );
}
