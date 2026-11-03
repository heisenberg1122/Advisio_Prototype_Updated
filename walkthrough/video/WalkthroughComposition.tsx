import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  BrowserFrame,
  CameraFrame,
  CaptionLayer,
  ChapterLabel,
  DemoCursor,
  FeatureCallout,
  IntroScene,
  OutroScene,
  ProgressBar,
  Spotlight,
  theme,
} from "./components";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { videoMotion } from "./motion";
import type { Beat, ChapterData, CompositionProps } from "./types";

function BeatVisual({
  chapter,
  beat,
  title,
}: {
  chapter: ChapterData;
  beat: Beat;
  title: string;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const event = beat.capture?.events.find(
    (item) => frame / fps >= item.at && frame / fps <= item.clickAt + 0.2,
  );
  if (beat.action === "intro")
    return (
      <IntroScene
        title={title.replace(/^ADVISIO\s+/, "")}
        subtitle="A guided tour of the Researcher workspace and its core features."
      />
    );
  if (beat.action === "outro") return <OutroScene />;
  return (
    <AbsoluteFill>
      <ChapterLabel index={chapter.index} title={chapter.title} />
      <FeatureCallout text={beat.callout} />
      <BrowserFrame>
        <CameraFrame
          mode={beat.framing || "overview"}
          focus={beat.capture?.focus}
        >
          <OffthreadVideo
            muted
            src={staticFile(beat.capture!.clip)}
            style={{ width: 1920, height: 1080 }}
          />
          <Spotlight event={event} />
          <DemoCursor events={beat.capture!.events} />
        </CameraFrame>
      </BrowserFrame>
      {beat.visual === "workflow" && (
        <Sequence from={6 * fps} durationInFrames={12 * fps}>
          <WorkflowTimeline />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
function HeldVisual({
  chapter,
  beat,
  title,
}: {
  chapter: ChapterData;
  beat: Beat;
  title: string;
}) {
  const frame = useCurrentFrame();
  return (
    <Freeze frame={Math.min(frame, beat.durationInFrames - 1)}>
      <BeatVisual chapter={chapter} beat={beat} title={title} />
    </Freeze>
  );
}
export function WalkthroughComposition({
  timeline,
  burnCaptions,
}: CompositionProps) {
  const frame = useCurrentFrame();
  const transition = videoMotion.chapterFrames;
  return (
    <AbsoluteFill
      style={{ background: theme.paper, fontFamily: "Arial, sans-serif" }}
    >
      <TransitionSeries>
        {timeline.chapters.flatMap((chapter, index) => [
          ...(index
            ? [
                <TransitionSeries.Transition
                  key={chapter.id + "-fade"}
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: transition })}
                />,
              ]
            : []),
          <TransitionSeries.Sequence
            key={chapter.id}
            durationInFrames={
              chapter.durationInFrames +
              (index < timeline.chapters.length - 1 ? transition : 0)
            }
          >
            <AbsoluteFill style={{ background: theme.paper }}>
              {chapter.beats.map((beat, beatIndex) => (
                <Sequence
                  key={beat.key}
                  from={beat.from - chapter.from}
                  durationInFrames={
                    beat.durationInFrames +
                    (beatIndex === chapter.beats.length - 1 ? transition : 0)
                  }
                >
                  <HeldVisual
                    chapter={chapter}
                    beat={beat}
                    title={timeline.title}
                  />
                </Sequence>
              ))}
            </AbsoluteFill>
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      {timeline.chapters.flatMap((chapter) =>
        chapter.beats.map((beat) => (
          <Sequence
            key={beat.key + "-audio"}
            from={beat.from}
            durationInFrames={beat.durationInFrames}
          >
            <Audio src={staticFile(beat.audio)} />
            {burnCaptions && <CaptionLayer captions={beat.captions} />}
          </Sequence>
        )),
      )}
      <ProgressBar
        progress={frame / Math.max(1, timeline.durationInFrames - 1)}
      />
    </AbsoluteFill>
  );
}
