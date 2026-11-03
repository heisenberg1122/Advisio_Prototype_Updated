import React from "react";
import { Composition, registerRoot } from "remotion";
import { WalkthroughComposition } from "./WalkthroughComposition";
import type { CompositionProps } from "./types";

const defaults: CompositionProps = {
  timeline: {
    id: "unconfigured",
    title: "Walkthrough",
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 1,
    chapters: [],
  },
  burnCaptions: true,
};
const Root = () => (
  <Composition
    id="RoleWalkthrough"
    component={WalkthroughComposition}
    defaultProps={defaults}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={1}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.timeline.durationInFrames,
      width: props.timeline.width,
      height: props.timeline.height,
      fps: props.timeline.fps,
    })}
  />
);
registerRoot(Root);
