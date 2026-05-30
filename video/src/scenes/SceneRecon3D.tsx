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
function useReconScene() {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [handle] = useState(() => delayRender("load-scene-glb"));

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      staticFile("scene.glb"),
      (gltf) => {
        const root = gltf.scene;
        // Colored points; brighten the frustum meshes to teal-ish.
        root.traverse((o) => {
          const any = o as unknown as { isPoints?: boolean; isMesh?: boolean; material?: THREE.Material };
          if (any.isPoints) {
            any.material = new THREE.PointsMaterial({
              size: 1.7, // pixels (sizeAttenuation off → constant, clearly visible)
              vertexColors: true,
              sizeAttenuation: false,
              transparent: true,
              opacity: 1,
            });
          } else if (any.isMesh) {
            any.material = new THREE.MeshBasicMaterial({
              color: new THREE.Color(palette.accent),
              wireframe: true,
              transparent: true,
              opacity: 0.45,
            });
          }
        });
        // Centre the cloud at the origin so it orbits cleanly.
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);
        setScene(root);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return scene;
}

const ReconModel: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const scene = useReconScene();
  // Slow orbit + a gentle settle-in scale.
  const spin = -0.5 + (frame / fps) * 0.42; // rad — slow orbit, starts slightly off-axis
  const grow = interpolate(frame, [0, 30], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!scene) return null;
  return (
    <group rotation={[0.34, spin, 0]} scale={grow * 5.2}>
      <primitive object={scene} />
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
