import { useState, type CSSProperties } from "react";

/**
 * 3D-reconstruction view (full-screen overlay over the map showcase).
 *
 * Source of the fly-through video. Default = a bundled, offline-safe render.
 * To show the LIVE pod result instead (audience uploads → reconstruction),
 * point this at the RunPod HTTP proxy, e.g.:
 *   const RECON_VIDEO_SRC = "https://<POD_ID>-8008.proxy.runpod.net/outputs/latest.mp4";
 * (plain <video> playback needs no CORS.)
 */
const RECON_VIDEO_SRC = "/recon/hero.mp4";

export function ReconstructionView({ onClose }: { onClose: () => void }) {
  const [errored, setErrored] = useState(false);

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

      {errored ? (
        <div style={fallbackStyle}>
          No reconstruction video yet. Drop a render at <code>angles/public/recon/hero.mp4</code>,
          or point <code>RECON_VIDEO_SRC</code> at the live pod URL.
        </div>
      ) : (
        <video
          src={RECON_VIDEO_SRC}
          controls
          autoPlay
          loop
          playsInline
          onError={() => setErrored(true)}
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
