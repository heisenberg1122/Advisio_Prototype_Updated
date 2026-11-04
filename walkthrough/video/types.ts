export type Caption = { text: string; startMs: number; endMs: number };
export type CaptureEvent = {
  at: number;
  clickAt: number;
  x: number;
  y: number;
  box: { x: number; y: number; width: number; height: number };
};
export type Beat = {
  framing?: "overview" | "focus" | "detail";
  visual?: "workflow" | "submission";
  key: string;
  action: string;
  callout: string;
  narration: string;
  from: number;
  durationInFrames: number;
  audio: string;
  captions: Caption[];
  capture?: {
    clip: string;
    events: CaptureEvent[];
    focus?: { x: number; y: number };
    zoom?: number;
  };
};
export type ChapterData = {
  id: string;
  index: number;
  title: string;
  route: string | null;
  from: number;
  durationInFrames: number;
  beats: Beat[];
};
export type Timeline = {
  title: string;
  id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  chapters: ChapterData[];
};
export type CompositionProps = { timeline: Timeline; burnCaptions: boolean; templateOnly?: boolean };
