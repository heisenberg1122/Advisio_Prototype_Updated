import { useId } from "react";
import { ArrowDown } from "lucide-react";
import "./product-film.css";

export function ProductFilm() {
  const titleId = useId();

  return (
    <section
      id="product-film"
      className="lp-film-section"
      aria-labelledby={titleId}
    >
      <div className="lp-container">
        <div className="lp-film-card">
          <div className="lp-film-copy">
            <p className="lp-eyebrow">
              <span className="lp-status-dot" /> Product overview
            </p>
            <h2 id={titleId}>Research, connected.</h2>
            <p className="lp-film-intro">
              See how Advisio brings the research workflow together.
            </p>
            <a href="#workflow" className="lp-film-link">
              Explore the research workflow{" "}
              <ArrowDown size={17} aria-hidden="true" />
            </a>
          </div>
          <img
            className="lp-film-poster"
            src="/product-film/workspace-at-0036.jpg"
            alt="Advisio research workspace"
            width={1920}
            height={1080}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
