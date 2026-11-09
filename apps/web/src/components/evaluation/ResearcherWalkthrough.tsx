import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import guide from "./researcher-guide.json";
import "./researcher-walkthrough.css";

export function ResearcherWalkthrough({
  standalone = false,
  context = "general",
}: {
  standalone?: boolean;
  context?: "general" | "evaluation";
}) {
  const Title = standalone ? "h1" : "h2";
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
          ? "Read the written guide below or start your activities at any time."
          : "A guided tour of the Researcher workspace and its core features. Return to any chapter for a refresher while using ADVISIO."}
      </p>
      <div className="rw-actions">
        {!standalone && (
          <a
            href="/walkthrough/research-dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open guide in new tab <ExternalLink size={16} aria-hidden="true" />
          </a>
        )}
        {context === "general" && (
          <Link to="/student/dashboard">Explore ADVISIO</Link>
        )}
      </div>
      <details
        id="researcher-written-guide"
        className="rw-guide"
        open={standalone}
      >
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
