import React from "react";
import { Composition } from "remotion";
import { OpenEyesPromo } from "./OpenEyesPromo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="OpenEyesPromo"
      component={OpenEyesPromo}
      durationInFrames={1051}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
