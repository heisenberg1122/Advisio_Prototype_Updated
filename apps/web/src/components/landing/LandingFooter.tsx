import { Link } from "react-router-dom";
import { FooterSpotlightWordmark } from "./FooterSpotlightWordmark";
export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-top">
          <div>
            <Link to="/" className="lp-brand" aria-label="Advisio home">
              <img src="/ao-logo.png" alt="" />
              <span>advisio.</span>
            </Link>
            <p>Research advising and management, connected.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#platform">Platform</a>
            <a href="#workflow">Workflow</a>
            <a href="#roles">For Teams</a>
            <Link to="/login">Sign In</Link>
          </nav>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Advisio</span>
          <div>
            <a href="mailto:advisio.main@gmail.com">Contact</a>
            <Link to="/privacy-policy">Privacy</Link>
            <Link to="/terms-of-service">Terms</Link>
            <a href="#hero">Back to top ↑</a>
          </div>
        </div>
        <FooterSpotlightWordmark />
      </div>
    </footer>
  );
}
