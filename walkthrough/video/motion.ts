// Video-only motion. Product transitions use apps/web/src/lib/ui-motion.ts.
export const videoMotion = {
  chapterFrames: 18,
  moveFrames: 10,
  clickFrames: 9,
};
export const cameraScale = { overview: 1, focus: 1.045, detail: 1.1 } as const;
export type CameraMode = keyof typeof cameraScale;
export const easeInOut = (value: number) => value * value * (3 - 2 * value);
