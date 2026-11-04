import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import guide from "./researcher-guide.json";
import "./researcher-walkthrough.css";

type Media = {
  version: number;
  scriptHash: string;
  video: string;
  poster: string;
  captions: string;
  duration: number;
  chapters: { id: string; title: string; start: number; end: number }[];
};
const mediaRoot = "/walkthroughs/researcher/";
export function validMedia(value: unknown): value is Media {
  const media = value as Media;
  return (
    media?.version === 1 &&
    media.scriptHash === guide.scriptHash &&
    Number.isFinite(media.duration) &&
    media.duration > 0 &&
    media.duration <= 600 &&
    [media.video, media.poster, media.captions].every(
      (file) =>
        typeof file === "string" && /^[a-z0-9-]+\.(mp4|jpg|vtt)$/.test(file),
    ) &&
    Array.isArray(media.chapters) &&
    media.chapters.length === guide.chapters.length &&
    media.chapters.every(
      (chapter, index) =>
        chapter.id === guide.chapters[index].id &&
        chapter.title === guide.chapters[index].title &&
        Number.isFinite(chapter.start) &&
        Number.isFinite(chapter.end) &&
        chapter.start >= 0 &&
        chapter.end > chapter.start &&
        chapter.end <= media.duration + 0.1 &&
        (index === 0
          ? chapter.start === 0
          : Math.abs(chapter.start - media.chapters[index - 1].end) < 0.1),
    )
  );
}
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function ResearcherWalkthrough({
  standalone = false,
  context = "general",
}: {
  standalone?: boolean;
  context?: "general" | "evaluation";
}) {
  const Title = standalone ? "h1" : "h2";
  const video = useRef<HTMLVideoElement>(null);
  const [media, setMedia] = useState<Media | null>(null);
  const [failed, setFailed] = useState(false);
  const [captionError, setCaptionError] = useState(false);
  const [showVideo, setShowVideo] = useState(
    standalone || context === "evaluation",
  );
  const [current, setCurrent] = useState(0);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${mediaRoot}media.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Video metadata unavailable");
        const data = await response.json();
        if (!validMedia(data)) throw new Error("Invalid video metadata");
        setMedia(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  const jump = (seconds: number) => {
    if (!video.current) return;
    video.current.currentTime = seconds;
    video.current.focus();
    // Seeking never starts audio automatically.
  };
  return (
    <section
      className="researcher-walkthrough"
      aria-labelledby="researcher-walkthrough-heading"
    >
      <p className="rw-eyebrow">
        Researcher orientation{context === "evaluation" ? " · Optional" : ""}
      </p>
      <Title id="researcher-walkthrough-heading">
        ADVISIO Researcher Walkthrough
      </Title>
      <p>
        {context === "evaluation"
          ? "Watch the video or read the written guide below. You can start your activities at any time."
          : "A guided tour of the Researcher workspace and its core features. Return to any chapter for a refresher while using ADVISIO."}
      </p>
      <div className="rw-actions">
        <button
          type="button"
          aria-expanded={showVideo}
          aria-controls="researcher-video"
          onClick={() => setShowVideo((show) => !show)}
        >
          {showVideo ? "Hide video" : "Show video"}
        </button>
        {!standalone && (
          <a
            href="/walkthrough/research-dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open video in new tab <ExternalLink size={16} aria-hidden="true" />
          </a>
        )}
        {context === "general" && (
          <Link to="/student/dashboard">Explore ADVISIO</Link>
        )}
      </div>
      <div id="researcher-video" hidden={!showVideo}>
        {media && !failed ? (
          <>
            <video
              ref={video}
              controls
              playsInline
              preload="metadata"
              poster={`${mediaRoot}${media.poster}`}
              onError={() => setFailed(true)}
              onEnded={() => setEnded(true)}
              onTimeUpdate={(event) =>
                setCurrent(event.currentTarget.currentTime)
              }
              aria-label="ADVISIO Researcher walkthrough video"
              aria-describedby="researcher-player-help"
            >
              <source src={`${mediaRoot}${media.video}`} type="video/mp4" />
              <track
                kind="captions"
                src={`${mediaRoot}${media.captions}`}
                srcLang="en"
                label="English"
                default
                onError={() => setCaptionError(true)}
              />
              Your browser does not support this video. Read the written guide
              below.
            </video>
            {captionError && (
              <p role="status">
                Captions could not be loaded. The narration transcript and
                written guide are available below.
              </p>
            )}
            {ended && (
              <section
                className="rw-handoff"
                aria-label="Researcher walkthrough complete"
                aria-live="polite"
              >
                <h3>Researcher Walkthrough Complete</h3>
                <p>
                  Return to any section whenever you need a refresher while
                  using the Researcher workspace.
                </p>
              </section>
            )}
            <p id="researcher-player-help" className="rw-help">
              Use the player controls for play, pause, seek, volume, captions
              and fullscreen. Open Video chapters to jump to a section without
              starting playback.
            </p>
            <details
              className="rw-video-chapters"
              open={context !== "evaluation"}
            >
              <summary>Video chapters</summary>
              <button
                type="button"
                className="rw-restart"
                onClick={() => jump(0)}
              >
                Restart from beginning
              </button>
              <nav className="rw-chapters" aria-label="Walkthrough chapters">
                {media.chapters.map((chapter, index) => (
                  <button
                    type="button"
                    key={chapter.id}
                    aria-current={
                      current >= chapter.start && current < chapter.end
                        ? "true"
                        : undefined
                    }
                    onClick={() => jump(chapter.start)}
                  >
                    <span>
                      {String(index).padStart(2, "0")} · {chapter.title}
                    </span>
                    <small>{clock(chapter.start)}</small>
                  </button>
                ))}
              </nav>
            </details>
          </>
        ) : (
          <p className="rw-availability" role="status">
            {failed
              ? "The video could not be loaded."
              : "Loading the walkthrough video…"}{" "}
            You can read the written guide or continue to ADVISIO.
          </p>
        )}
      </div>
      <details id="researcher-written-guide" className="rw-guide">
        <summary>Read Written Guide</summary>
        {guide.chapters.map((chapter, index) => (
          <section key={chapter.id}>
            <h3>
              {index}. {chapter.title}
            </h3>
            <p>{chapter.guide}</p>
            <p className="rw-activity">Optional activity: {chapter.activity}</p>
          </section>
        ))}
      </details>
      <details className="rw-transcript">
        <summary>Read narration transcript</summary>
        {guide.chapters.map((chapter, index) => (
          <section key={chapter.id}>
            <h3>
              {index}. {chapter.title}
            </h3>
            {chapter.narration.split("\n\n").map((paragraph, part) => (
              <p key={part}>{paragraph}</p>
            ))}
          </section>
        ))}
      </details>
    </section>
  );
}

export default function ResearcherWalkthroughPage() {
  return (
    <main className="rw-page">
      <ResearcherWalkthrough standalone />
    </main>
  );
}
