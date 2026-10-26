import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown, ShieldCheck } from "lucide-react";
import { HeroProductVisual } from "./HeroProductVisual";

export function HeroSection() {
  return (
    <section id="hero" className="landing-hero">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-container relative">
        <div className="landing-hero-copy">
          <p
            className="landing-eyebrow landing-entrance"
            style={{ animationDelay: "0ms" }}
          >
            A connected academic research workspace
          </p>
          <h1 className="landing-entrance" style={{ animationDelay: "70ms" }}>
            Research, organized.
            <br />
            <span>From idea to completion.</span>
          </h1>
          <p
            className="landing-hero-description landing-entrance"
            style={{ animationDelay: "150ms" }}
          >
            Bring manuscripts, mentorship, and milestones together. One shared
            workspace for your entire research journey.
          </p>
          <div
            className="landing-hero-actions landing-entrance"
            style={{ animationDelay: "230ms" }}
          >
            <Link to="/login" className="landing-button landing-button-primary">
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              href="#solution"
              className="landing-button landing-button-secondary"
            >
              Explore Advisio <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
          <p
            className="landing-hero-note landing-entrance"
            style={{ animationDelay: "280ms" }}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            Purpose-built for higher education
          </p>
        </div>
        <div
          className="landing-hero-preview landing-entrance"
          style={{ animationDelay: "350ms" }}
        >
          <HeroProductVisual />
        </div>
      </div>
    </section>
  );
}
