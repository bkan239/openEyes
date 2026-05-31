import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { palette } from "./theme";
import { Grain } from "./components/Grain";
import { SceneHook } from "./scenes/SceneHook";
import { SceneProblem } from "./scenes/SceneProblem";
import { SceneCorroboration } from "./scenes/SceneCorroboration";
import { SceneAnglesHero } from "./scenes/SceneAnglesHero";
import { SceneRecon3D } from "./scenes/SceneRecon3D";
import { SceneTrust } from "./scenes/SceneTrust";
import { SceneOutro } from "./scenes/SceneOutro";

// Hook120 + Problem120 + Corro165 + Hero270 + Recon165 + Trust160 + Outro139 = 1139
// minus transitions (12+16+18+14+14+14 = 88) = 1051 frames (~35s @ 30fps).
export const OpenEyesPromo: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneProblem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={clockWipe({ width, height })} timing={linearTiming({ durationInFrames: 16 })} />

        <TransitionSeries.Sequence durationInFrames={165}>
          <SceneCorroboration />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={clockWipe({ width, height })} timing={linearTiming({ durationInFrames: 18 })} />

        <TransitionSeries.Sequence durationInFrames={270}>
          <SceneAnglesHero />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />

        <TransitionSeries.Sequence durationInFrames={165}>
          <SceneRecon3D />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />

        <TransitionSeries.Sequence durationInFrames={160}>
          <SceneTrust />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />

        <TransitionSeries.Sequence durationInFrames={139}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Grain />
    </AbsoluteFill>
  );
};
