import { useState, type CSSProperties } from "react";

/**
 * 3D-reconstruction view (full-screen overlay over the map showcase).
 *
 * Tries LIVE_URL first (the pod's latest reconstruction during the pitch), then
 * falls back to the bundled hero render. Set LIVE_URL to the RunPod proxy for the
 * live demo; leave it "" to just play the bundled file. Plain <video> needs no CORS.
 */
const LIVE_URL = ""; // e.g. "https://<POD_ID>-8008.proxy.runpod.net/outputs/latest.mp4"
const FALLBACK_URL = "/recon/hero.mp4";
const SOURCES = [LIVE_URL, FALLBACK_URL].filter(Boolean);

export function ReconstructionView({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const failed = idx >= SOURCES.length;

  return (
    <div style={overlayStyle}>
      <div style={captionStyle}>
        <div style={eyebrowStyle}>3D Reconstruction</div>
        <div style={titleStyle}>The scene, rebuilt from independent eyewitness photos</div>
        <div style={subStyle}>
          Novel viewpoints rendered from real captures — geometry that lines up across
          uncoordinated sources can't be faked.
        </div>
      </div>

      <button type="button" onClick={onClose} style={closeStyle} aria-label="Back to map">
        ← Back to map
      </button>

      {failed ? (
        <div style={fallbackStyle}>
          No reconstruction video available. Drop a render at
          <code> angles/public/recon/hero.mp4</code>, or set <code>LIVE_URL</code> to the
          live pod URL.
        </div>
      ) : (
        <video
          key={SOURCES[idx]}
          src={SOURCES[idx]}
          controls
          autoPlay
          loop
          playsInline
          onError={() => setIdx((i) => i + 1)}
          style={videoStyle}
        />
      )}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 110,
  background: "var(--bg, #1C1B19)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const videoStyle: CSSProperties = {
  maxWidth: "min(92vw, 1280px)",
  maxHeight: "82vh",
  width: "auto",
  height: "auto",
  borderRadius: 14,
  background: "#000",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(111,189,176,0.25)"
};

const captionStyle: CSSProperties = {
  position: "absolute",
  top: 70,
  left: 26,
  maxWidth: 440,
  pointerEvents: "none"
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.08,
  textTransform: "uppercase",
  color: "var(--accent, #6FBDB0)"
};

const titleStyle: CSSProperties = {
  fontSize: 19,
  fontWeight: 600,
  marginTop: 6,
  color: "var(--ink, #f4f1ea)",
  lineHeight: 1.25
};

const subStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  marginTop: 6,
  color: "var(--ink-dim, #a9a399)"
};

const closeStyle: CSSProperties = {
  position: "absolute",
  top: 22,
  right: 26,
  zIndex: 121,
  border: "1px solid rgba(252,251,248,0.16)",
  background: "rgba(38,36,31,0.86)",
  color: "var(--ink, #f4f1ea)",
  backdropFilter: "blur(10px)",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer"
};

const fallbackStyle: CSSProperties = {
  maxWidth: 460,
  textAlign: "center",
  padding: 24,
  fontSize: 13,
  lineHeight: 1.6,
  color: "var(--ink-dim, #a9a399)"
};
