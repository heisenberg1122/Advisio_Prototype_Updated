import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import dean from "../../../public/walkthroughs/dean/media.json";
import coordinator from "../../../public/walkthroughs/coordinator/media.json";
import adviser from "../../../public/walkthroughs/adviser/media.json";
import structured from "../../../public/walkthroughs/panelist-structured/media.json";
import pdf from "../../../public/walkthroughs/panelist-pdf/media.json";
import preparation from "../../../public/walkthroughs/panelist-preparation/media.json";
import { ResearcherWalkthrough } from "./ResearcherWalkthrough";

const guides = {
  dean: { folder: "dean", title: dean.title },
  professor: { folder: "coordinator", title: coordinator.title },
  adviser: { folder: "adviser", title: adviser.title },
  structured: { folder: "panelist-structured", title: structured.title },
  pdf: { folder: "panelist-pdf", title: pdf.title },
  preparation: { folder: "panelist-preparation", title: preparation.title },
};

export function EvaluationWalkthrough({ role }: { role?: string }) {
  const [panelistMode, setPanelistMode] = useState<
    "structured" | "pdf" | "preparation"
  >("structured");
  if (role === "student") return <ResearcherWalkthrough context="evaluation" />;
  const guide =
    role === "panelist"
      ? guides[panelistMode]
      : role === "dean" || role === "professor" || role === "adviser"
        ? guides[role]
        : null;
  if (!guide) return null;
  const { folder, title } = guide;
  return (
    <section
      className="researcher-walkthrough"
      aria-labelledby="role-walkthrough-heading"
    >
      <p className="rw-eyebrow">Optional written guide</p>
      <h2 id="role-walkthrough-heading">{title}</h2>
      <p>Read the walkthrough or start your activities at any time.</p>
      {role === "panelist" && (
        <div className="rw-actions">
          <label htmlFor="panelist-guide-mode">Choose a Panelist guide</label>
          <select
            id="panelist-guide-mode"
            value={panelistMode}
            onChange={(event) =>
              setPanelistMode(event.target.value as typeof panelistMode)
            }
          >
            <option value="structured">Structured evaluation</option>
            <option value="pdf">PDF evaluation</option>
            <option value="preparation">Defense preparation</option>
          </select>
        </div>
      )}
      <div className="rw-actions">
        <a
          href={`/walkthroughs/${folder}/index.html`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open written guide <ExternalLink size={16} aria-hidden="true" />
        </a>
        <a href={`/walkthroughs/${folder}/transcript.txt`}>Read transcript</a>
      </div>
    </section>
  );
}
