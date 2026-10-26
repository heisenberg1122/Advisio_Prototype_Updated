import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";

export function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        menuButtonRef.current?.getAttribute("aria-expanded") === "true"
      ) {
        setMobileMenuOpen(false);
        menuButtonRef.current.focus();
      }
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const navLinks = [
    { label: "Overview", href: "#hero" },
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#solution" },
    { label: "Workflow", href: "#workflow" },
    { label: "Roles", href: "#roles" },
    { label: "Analytics", href: "#analytics" },
  ];

  return (
    <header
      className={`landing-navbar fixed top-0 left-0 right-0 z-50 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3"
          : "bg-white/80 backdrop-blur-xs border-b border-slate-100 py-3"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 text-left group select-none"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-md shadow-[#0b3553]/15 transition-transform group-hover:scale-105">
            <img
              src="/ao-logo.png"
              alt="Advisio"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <span className="block font-sans text-xl font-extrabold tracking-tight text-[#0b3553]">
              ADVISIO
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#b8860b]">
              Research Platform
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden xl:flex items-center gap-7 text-sm font-semibold text-slate-600"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-[#0b3553] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3553] rounded-md px-1 py-0.5"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-xl px-4 py-2 text-sm font-bold text-[#0b3553] hover:bg-slate-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0b3553] px-4.5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#124569] active:scale-[0.98] transition-all"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="xl:hidden flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      <div
        id="landing-mobile-menu"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        data-open={mobileMenuOpen}
        className="landing-mobile-drawer xl:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-slate-200 bg-white/98 backdrop-blur-xl px-6 py-5 shadow-xl"
      >
        <nav
          aria-label="Mobile navigation"
          className="flex flex-col gap-4 text-base font-semibold text-slate-700 pb-4 border-b border-slate-100"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-[#0b3553]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="pt-4 flex flex-col gap-2.5">
          <Link
            to="/login"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-[#0b3553]"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full text-center py-2.5 rounded-xl bg-[#0b3553] text-sm font-bold text-white shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
