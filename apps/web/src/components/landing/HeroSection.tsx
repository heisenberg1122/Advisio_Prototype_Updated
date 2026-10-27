import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { HeroProductVisual } from "./HeroProductVisual";

export function HeroSection() {
  return (
    <section id="hero" className="lp-hero" data-scene>
      <div className="lp-mesh" aria-hidden="true" />
      <div className="lp-container">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">
            <span className="lp-status-dot" /> Research management, connected
          </p>
          <h1>
            <span className="lp-line-mask">
              <span>Move research forward.</span>
            </span>
            <span className="lp-line-mask">
              <span>Keep the thread.</span>
            </span>
          </h1>
          <p className="lp-intro">
            Advisio brings researchers, advisers, documents, reviews, and
            institutional workflows into one connected research workspace.
          </p>
          <div className="lp-actions">
            <a href="#platform" className="lp-button lp-button-primary">
              Explore Advisio <ArrowUpRight size={17} />
            </a>
            <Link to="/login" className="lp-button lp-button-quiet">
              Sign In <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <HeroProductVisual />
        <div className="lp-hero-caption">
          <span>Less scattered. More connected.</span>
          <a href="#platform">
            Discover the workspace <ArrowDown size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
