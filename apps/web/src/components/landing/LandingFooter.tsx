import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, GraduationCap, ArrowUpRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-slate-600 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
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
                  Research Advising & Management Platform
                </span>
              </div>
            </Link>

            <p className="mt-4 max-w-sm text-sm text-slate-500 leading-relaxed">
              Advisio is the centralized research management ecosystem for higher education institutions. Unifying student researchers, faculty mentors, examination committees, and university deans into a synchronized, transparent workspace.
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4 text-[#0b3553]" />
              <span>Role-based access · Document integrity · Google sign-in</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-[#0b3553] text-[11px]">
              Platform
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#hero" className="hover:text-[#0b3553] transition-colors">
                  Overview
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-[#0b3553] transition-colors">
                  Core Features
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-[#0b3553] transition-colors">
                  Research Workflow
                </a>
              </li>
              <li>
                <a href="#collaboration" className="hover:text-[#0b3553] transition-colors">
                  Manuscript Review
                </a>
              </li>
              <li>
                <a href="#analytics" className="hover:text-[#0b3553] transition-colors">
                  Dean Analytics
                </a>
              </li>
              <li>
                <a href="#integrations" className="hover:text-[#0b3553] transition-colors">
                  Google Workspace
                </a>
              </li>
            </ul>
          </div>

          {/* Role Portals */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-[#0b3553] text-[11px]">
              Stakeholder Portals
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  Student Researchers
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  Research Advisers
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  Defense Panelists
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  Deans & Coordinators
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  Research Ethics Board
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#0b3553] transition-colors">
                  System Administration
                </Link>
              </li>
            </ul>
          </div>

          {/* Governance & Institutional Trust */}
          <div>
            <h4 className="font-bold uppercase tracking-wider text-[#0b3553] text-[11px]">
              Governance & Policies
            </h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to="/privacy-policy" className="hover:text-[#0b3553] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="hover:text-[#0b3553] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-[#0b3553] transition-colors">
                  Google API Disclosure
                </Link>
              </li>
              <li>
                <a href="#security" className="hover:text-[#0b3553] transition-colors">
                  Cryptographic Integrity
                </a>
              </li>
              <li>
                <a href="mailto:advisio.main@gmail.com" className="hover:text-[#0b3553] transition-colors">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
          <p>© 2026 Advisio. All rights reserved. Purpose-built for higher education academic research excellence.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="hover:text-[#0b3553]">
              Privacy
            </Link>
            <Link to="/terms-of-service" className="hover:text-[#0b3553]">
              Terms
            </Link>
            <a href="#hero" className="hover:text-[#0b3553] font-semibold text-[#0b3553]">
              Back to Top ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
