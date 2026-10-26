import React, { useEffect } from "react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { PlatformValueStrip } from "@/components/landing/PlatformValueStrip";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { RoleExperience } from "@/components/landing/RoleExperience";
import { CollaborationSection } from "@/components/landing/CollaborationSection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { IntegrationsSection } from "@/components/landing/IntegrationsSection";
import { SecurityTrustSection } from "@/components/landing/SecurityTrustSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import "@/components/landing/landing.css";

export default function HomePage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Advisio: A Research Advising and Management Platform";
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="landing-page min-h-screen bg-white font-sans text-slate-900 flex flex-col selection:bg-[#ffad14]/30 selection:text-[#0b3553]">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-xl focus:bg-[#0b3553] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Sticky High-End Navigation Bar */}
      <LandingNavbar />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* 1. High-Impact Hero with Product UI Mockup */}
        <HeroSection />

        {/* 2. Platform Value / Stakeholder Ecosystem Relationship Flow */}
        <PlatformValueStrip />

        {/* 3. Problem vs. Solution (Status Quo vs. Advisio) */}
        <ProblemSolution />

        {/* 4. Core Features Bento Grid */}
        <FeatureBento />

        {/* 5. 8-Stage Research Progression Stepper Workflow */}
        <WorkflowSection />

        {/* 6. Role-Based Portals & Specialized Workspaces */}
        <RoleExperience />

        {/* 7. Document Collaboration, Inline Feedback & Versioning */}
        <CollaborationSection />

        {/* 8. Institutional Analytics, Workload Balances & Quorum */}
        <AnalyticsSection />

        {/* 9. Google Workspace & Academic Tool Integrations */}
        <IntegrationsSection />

        {/* 10. Security, RBAC & Cryptographic Integrity Ledger */}
        <SecurityTrustSection />

        {/* 11. Final Conversion Call To Action */}
        <FinalCtaSection />
      </main>

      {/* High-End Academic Multi-Column Footer */}
      <LandingFooter />
    </div>
  );
}
