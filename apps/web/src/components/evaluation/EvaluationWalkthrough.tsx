import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import dean from "../../../public/walkthroughs/dean/media.json";
import coordinator from "../../../public/walkthroughs/coordinator/media.json";
import adviser from "../../../public/walkthroughs/adviser/media.json";
import structured from "../../../public/walkthroughs/panelist-structured/media.json";
import pdf from "../../../public/walkthroughs/panelist-pdf/media.json";
import preparation from "../../../public/walkthroughs/panelist-preparation/media.json";
import { ResearcherWalkthrough } from "./ResearcherWalkthrough";

const recordings = {
  dean: { folder: "dean", media: dean },
  professor: { folder: "coordinator", media: coordinator },
  adviser: { folder: "adviser", media: adviser },
  structured: { folder: "panelist-structured", media: structured },
  pdf: { folder: "panelist-pdf", media: pdf },
  preparation: { folder: "panelist-preparation", media: preparation },
};

export function EvaluationWalkthrough({ role }: { role?: string }) {
  const [panelistMode, setPanelistMode] = useState<
    "structured" | "pdf" | "preparation"
  >("structured");
  const [failed, setFailed] = useState(false);
  if (role === "student") return <ResearcherWalkthrough context="evaluation" />;
  const recording =
    role === "panelist"
      ? recordings[panelistMode]
      : role === "dean" || role === "professor" || role === "adviser"
        ? recordings[role]
        : null;
  if (!recording) return null;
  const { folder, media } = recording;
  const root = `/walkthroughs/${folder}/`;
  return (
    <section
      className="researcher-walkthrough"
      aria-labelledby="role-walkthrough-heading"
    >
      <p className="rw-eyebrow">Optional video guide</p>
      <h2 id="role-walkthrough-heading">{media.title}</h2>
      <p>
        Watch the walkthrough, read the guide below, or start your activities at
        any time. Watching the video is optional.
      </p>
      {role === "panelist" && (
        <div className="rw-actions">
          <label htmlFor="panelist-video-mode">Choose a Panelist guide</label>
          <select
            id="panelist-video-mode"
            value={panelistMode}
            onChange={(event) => {
              setPanelistMode(event.target.value as typeof panelistMode);
              setFailed(false);
            }}
          >
            <option value="structured">Structured evaluation</option>
            <option value="pdf">PDF evaluation</option>
            <option value="preparation">Defense preparation</option>
          </select>
        </div>
      )}
      <video
        key={folder}
        controls
        playsInline
        preload="metadata"
        poster={`${root}${media.poster}`}
        aria-label={media.title}
        onError={() => setFailed(true)}
      >
        <source src={`${root}${media.video}`} type="video/mp4" />
        <track
          kind="captions"
          src={`${root}${media.captions}`}
          srcLang="en"
          label="English"
          default
        />
        Your browser does not support this video. Use the download link below.
      </video>
      {failed && (
        <p className="rw-availability" role="status">
          The video could not load. Try the download link, read the guide below,
          or continue to your activities.
        </p>
      )}
      <div className="rw-actions">
        <a href={`${root}index.html`} target="_blank" rel="noopener noreferrer">
          Open video in new tab <ExternalLink size={16} aria-hidden="true" />
        </a>
        <a href={`${root}${media.video}`} download>
          Download video
        </a>
        <a
          href={`${root}transcript.txt`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read narration transcript
        </a>
      </div>
    </section>
  );
}
