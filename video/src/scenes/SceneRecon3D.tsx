import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  delayRender,
  continueRender,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { reveal, blurInStyle, outAt } from "../lib/anim";

/**
 * Loads the REAL reconstruction (services/recon3d/viewer/scene.glb): a 600k-point
 * colored cloud + camera frustums. Centred, point-sized, returned as a group.
 */
/** Boost the (dark, street-coloured) vertex colours so the cloud reads on ink. */
function boostColors(geom: THREE.BufferGeometry, mul: number, lift: number) {
  const c = geom.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!c) return;
  const a = c.array as unknown as Float32Array | Uint8Array;
  const isByte = a instanceof Uint8Array;
  const max = isByte ? 255 : 1;
  for (let i = 0; i < a.length; i++) {
    const v = (a[i] / max) * mul + lift;
    a[i] = Math.min(1, v) * max;
  }
  c.needsUpdate = true;
}

interface Loaded {
  scene: THREE.Group;
  fitScale: number;
}

function useReconScene(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [handle] = useState(() => delayRender("load-scene-glb"));

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      staticFile("scene.glb"),
      (gltf) => {
        const root = gltf.scene;
        root.traverse((o) => {
          const any = o as unknown as {
            isPoints?: boolean;
            isMesh?: boolean;
            material?: THREE.Material;
            geometry?: THREE.BufferGeometry;
          };
          if (any.isPoints && any.geometry) {
            boostColors(any.geometry, 2.1, 0.16);
            any.material = new THREE.PointsMaterial({
              size: 2.6, // px (constant — sizeAttenuation off)
              vertexColors: true,
              sizeAttenuation: false,
              transparent: true,
              opacity: 0.98,
              depthWrite: false,
            });
          } else if (any.isMesh) {
            // Camera frustums → glowing teal wireframe.
            any.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(palette.accent),
              wireframe: true,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
            });
          }
        });
        // Centre on the bounding sphere and auto-fit so it always frames well.
        const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
        root.position.sub(sphere.center);
        const fitScale = sphere.radius > 0 ? 1.18 / sphere.radius : 1;
        setLoaded({ scene: root, fitScale });
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return loaded;
}

const ReconModel: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const loaded = useReconScene();
  const spin = -0.5 + (frame / fps) * 0.42; // rad — slow orbit, starts slightly off-axis
  const grow = interpolate(frame, [0, 30], [0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!loaded) return null;
  return (
    <group rotation={[0.42, spin, 0]} scale={loaded.fitScale * grow}>
      <primitive object={loaded.scene} />
    </group>
  );
};

/** 3D reconstruction beat — orbit the real point cloud; "geometry that can't be faked." */
export const SceneRecon3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const fade = reveal(frame, 4, 16) * outAt(frame, 150, 16);
  const kicker = reveal(frame, 10, 14);
  const cap = reveal(frame, 30, 16) * outAt(frame, 150, 14);
  const sub = reveal(frame, 120, 14) * outAt(frame, 150, 12);

  // memoize camera so ThreeCanvas doesn't reset each frame
  const camera = useMemo(() => ({ fov: 45, position: [0, 0.2, 2.6] as [number, number, number], near: 0.01, far: 100 }), []);

  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <AbsoluteFill style={{ background: "radial-gradient(60% 55% at 50% 46%, rgba(111,189,176,0.07) 0%, rgba(28,27,25,0) 62%)" }} />

      <AbsoluteFill style={{ opacity: fade }}>
        <ThreeCanvas width={width} height={height} camera={camera} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
          <ambientLight intensity={1.4} />
          <ReconModel frame={frame} fps={fps} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* kicker top-left */}
      <div style={{ position: "absolute", top: 56, left: 64, fontFamily: FONT.mono, fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: palette.accent, opacity: kicker }}>
        3D Reconstruction
      </div>

      {/* caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 150,
          textAlign: "center",
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 500,
          color: palette.ink,
          ...blurInStyle(cap, 8, 14),
          opacity: cap,
        }}
      >
        Geometry that <em style={{ fontStyle: "italic", color: palette.accent }}>can&apos;t be faked</em>.
      </div>

      {/* data sub-label */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 108, textAlign: "center", fontFamily: FONT.mono, fontSize: 14, letterSpacing: 2.5, color: palette.inkDim, opacity: sub }}>
        600,000 POINTS · 5 ANGLES · NO COLMAP
      </div>
    </AbsoluteFill>
  );
};
