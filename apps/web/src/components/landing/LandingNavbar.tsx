import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LandingThemeToggle } from "./LandingThemeToggle";
import type { LandingTheme } from "./useLandingTheme";
const links = [
  { label: "Platform", href: "#platform" },
  { label: "Workflow", href: "#workflow" },
  { label: "For Teams", href: "#roles" },
];

export function LandingNavbar({
  theme,
  onToggleTheme,
}: {
  theme: LandingTheme;
  onToggleTheme: (button: HTMLElement) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 24);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 900px)");
    const resize = () => {
      if (wide.matches) setOpen(false);
    };
    document.addEventListener("keydown", close);
    wide.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", close);
      wide.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="lp-nav">
        <Link to="/" className="lp-brand" aria-label="Advisio home">
          <img src="/ao-logo.png" alt="" />
          <span>
            advisio<span className="lp-brand-dot">.</span>
          </span>
        </Link>
        <nav className="lp-desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-actions">
          <LandingThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Link to="/login" className="lp-nav-signin">
            Sign In
          </Link>
          <Link
            to="/login"
            className="lp-button lp-button-primary lp-nav-start"
          >
            Get Started <ArrowUpRight size={15} />
          </Link>
          <button
            ref={triggerRef}
            type="button"
            className="lp-menu-trigger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="landing-mobile-menu"
          className="lp-mobile-menu"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
              <ArrowUpRight size={16} />
            </a>
          ))}
          <Link to="/login" onClick={() => setOpen(false)}>
            Get Started <ArrowUpRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}
