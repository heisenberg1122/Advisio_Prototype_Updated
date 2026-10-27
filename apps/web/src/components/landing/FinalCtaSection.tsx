import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
export function FinalCtaSection() {
  return (
    <section id="get-started" className="lp-final-cta lp-section" data-scene>
      <div className="lp-container">
        <p className="lp-eyebrow">Your next chapter starts here</p>
        <h2>
          Research has enough complexity.
          <br />
          <span>Managing it shouldn&apos;t add more.</span>
        </h2>
        <p>
          Bring your research, your people, and your next milestone together.
        </p>
        <div className="lp-actions">
          <Link to="/login" className="lp-button lp-button-gold">
            Get Started <ArrowUpRight size={17} />
          </Link>
          <Link to="/login" className="lp-button lp-button-on-dark">
            Sign In <ArrowUpRight size={16} />
          </Link>
        </div>
        <Link to="/register" className="lp-account-link">
          Need access? Request an account <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
