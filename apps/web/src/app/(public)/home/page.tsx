import { useEffect, useRef } from "react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { RoleExperience } from "@/components/landing/RoleExperience";
import { SecurityTrustSection } from "@/components/landing/SecurityTrustSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import "@/components/landing/landing.css";

export default function HomePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Advisio — Research, connected.";
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-in-view", entry.isIntersecting);
          if (entry.isIntersecting) entry.target.classList.add("has-entered");
        });
      },
      { threshold: 0.12 },
    );
    pageRef.current
      ?.querySelectorAll("[data-scene]")
      .forEach((scene) => observer.observe(scene));
    if (window.location.hash)
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
    return () => {
      observer.disconnect();
      document.title = previousTitle;
    };
  }, []);
  return (
    <div ref={pageRef} className="landing-page">
      <a href="#main-content" className="lp-skip">
        Skip to content
      </a>
      <LandingNavbar />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <ProblemSolution />
        <WorkflowSection />
        <RoleExperience />
        <SecurityTrustSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
