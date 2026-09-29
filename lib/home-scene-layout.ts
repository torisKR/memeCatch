export type HomeSceneLayout = "stacked" | "spread";

export type HomeSceneLayoutObjectName =
  | "speech-loop-emblem"
  | "editorial-card-left-assembly"
  | "editorial-card-right-assembly"
  | "signal-token-check"
  | "signal-token-context"
  | "signal-token-clock"
  | "signal-token-stop";

export type HomeSceneObjectPose = {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
};

type HomeSceneLayoutPose = Record<HomeSceneLayoutObjectName, HomeSceneObjectPose>;

export const HOME_SCENE_LAYOUT_POSES: Record<HomeSceneLayout, HomeSceneLayoutPose> = {
  stacked: {
    "speech-loop-emblem": {
      position: [0.18, 0.18, 0.58],
      rotation: [0.12, -0.46, -0.13],
    },
    "editorial-card-left-assembly": {
      position: [-0.82, 0.48, -1.12],
      rotation: [-0.05, 0.2, -0.14],
    },
    "editorial-card-right-assembly": {
      position: [0.86, -0.24, -1.28],
      rotation: [0.06, -0.22, 0.14],
    },
    "signal-token-check": {
      position: [2.72, 1.42, 1.1],
      rotation: [-0.05, -0.18, -0.08],
    },
    "signal-token-context": {
      position: [2.5, -1.2, 0.86],
      rotation: [0.04, -0.2, 0.08],
    },
    "signal-token-clock": {
      position: [-2.16, -1.38, 0.82],
      rotation: [0.03, 0.2, -0.08],
    },
    "signal-token-stop": {
      position: [-2.4, 1.18, 0.86],
      rotation: [-0.04, 0.18, 0.1],
    },
  },
  spread: {
    "speech-loop-emblem": {
      position: [-0.08, 0.04, 0.76],
      rotation: [0.08, -0.3, -0.04],
    },
    "editorial-card-left-assembly": {
      position: [-1.92, 0.72, -0.68],
      rotation: [-0.08, 0.08, -0.18],
    },
    "editorial-card-right-assembly": {
      position: [1.9, -0.58, -0.82],
      rotation: [0.09, -0.1, 0.18],
    },
    "signal-token-check": {
      position: [3.02, 1.48, 1.04],
      rotation: [-0.08, -0.12, -0.12],
    },
    "signal-token-context": {
      position: [3.12, -1.52, 0.96],
      rotation: [0.06, -0.14, 0.12],
    },
    "signal-token-clock": {
      position: [-2.86, -1.68, 0.94],
      rotation: [0.05, 0.14, -0.12],
    },
    "signal-token-stop": {
      position: [-3.02, 1.5, 0.98],
      rotation: [-0.06, 0.12, 0.14],
    },
  },
};
