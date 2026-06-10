// The "space" canvas overlays: a subtle dot grid + a top-center violet glow.
// Fixed, non-interactive layers that sit behind page content.
import { ACCENT2, hexA } from "lib/arcade";

export default function ArcadeBackground() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 520,
          background: `radial-gradient(closest-side, ${hexA(ACCENT2, 0.2)}, transparent)`,
          filter: "blur(20px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}
