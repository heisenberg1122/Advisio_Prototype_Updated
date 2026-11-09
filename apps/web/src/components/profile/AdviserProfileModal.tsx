"use client";

import React, { useEffect, useRef } from "react";
import {
  X,
  Mail,
  Building2,
  Award,
  BookOpen,
  GraduationCap,
  Briefcase,
  FileText,
  Lightbulb,
  CheckCircle2,
  ExternalLink,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import "@/components/dashboards/role-home.css";
import "./faculty-profile.css";
import { Button } from "@/components/ui/Button";
import { usePublicFacultyProfile } from "@/hooks/use-faculty-profile";

export interface AdviserProfileModalProps {
  adviser: any;
  isOpen: boolean;
  onClose: () => void;
  onRequestAdviser?: (adviser: any) => void;
  canRequest?: boolean;
}

export function AdviserProfileModal({
  adviser,
  isOpen,
  onClose,
  onRequestAdviser,
  canRequest = true,
}: AdviserProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = usePublicFacultyProfile(isOpen ? adviser?.id : null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !adviser) return null;

  const publicData = data?.adviser;
  const profile = publicData?.profile;

  const academicTitle = profile?.academicTitle?.trim() || adviser.facultyProfile?.academicTitle || "";
  const facultyDesignation = profile?.facultyDesignation?.trim() || adviser.facultyProfile?.facultyDesignation || "Faculty Research Adviser";
  const department = profile?.department?.trim() || adviser.facultyProfile?.department || adviser.college || "Academic Department";
  const collegeName = publicData?.college || adviser.college || "College of Computing";
  const fullName = publicData?.name || adviser.name || "Faculty Adviser";
  const email = publicData?.email || adviser.email || "";

  // Real-time capacity from authoritative API
  const capacity = publicData?.capacity || {
    adviseeCount: adviser.adviseeCount ?? 0,
    maxAdviseeGroups: adviser.maxAdviseeGroups ?? 5,
    availableSlots: adviser.availableSlots ?? 0,
    isAcceptingAdvisees: adviser.isAcceptingAdvisees ?? true,
    isFull: adviser.isFull ?? false,
  };

  const educations = Array.isArray(profile?.educations) ? profile!.educations : [];
  const experiences = Array.isArray(profile?.experiences) ? profile!.experiences : [];
  const certifications = Array.isArray(profile?.certifications) ? profile!.certifications : [];
  const publications = Array.isArray(profile?.publications) ? profile!.publications : [];
  const awards = Array.isArray(profile?.awards) ? profile!.awards : [];
  const expertiseKeywords = Array.isArray(profile?.expertiseKeywords)
    ? profile!.expertiseKeywords
    : (adviser.facultyProfile?.expertiseKeywords || []);
  const researchInterests = Array.isArray(profile?.researchInterests) ? profile!.researchInterests : [];
  const specializedTopics = Array.isArray(profile?.specializedTopics) ? profile!.specializedTopics : [];

  const hasExtendedContent = Boolean(
    profile?.biography ||
    profile?.mentoringPhilosophy ||
    expertiseKeywords.length > 0 ||
    educations.length > 0 ||
    researchInterests.length > 0 ||
    specializedTopics.length > 0 ||
    profile?.preferredProjectTypes ||
    experiences.length > 0 ||
    publications.length > 0 ||
    certifications.length > 0 ||
    awards.length > 0 ||
    profile?.advisingPreferences
  );

  const handleRequestClick = () => {
    onClose();
    if (onRequestAdviser) {
      onRequestAdviser(adviser);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adviser-cv-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="faculty-scope w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--color-background)] shadow-2xl overflow-hidden"
      >
        <div className="faculty-popup-top">
          <span className="faculty-popup-avatar" aria-hidden="true">
            {profile?.photoUrl ? <img src={profile.photoUrl} alt="" /> : adviser.initials}
          </span>
          <div className="faculty-popup-who">
            <h2 id="adviser-cv-title">
              {academicTitle ? `${academicTitle} ${fullName}` : fullName}{" "}
              <i className="ti ti-rosette-discount-check" role="img" aria-label="Verified adviser" style={{ fontSize: 18 }} />
            </h2>
            <p>{[facultyDesignation, department, collegeName].filter(Boolean).join(" · ")}</p>
            {email && <p>{email}</p>}
          </div>
          <dl className="faculty-popup-counts" aria-label="Current advising capacity">
            <div><dd>{capacity.adviseeCount} of {capacity.maxAdviseeGroups}</dd><dt>Groups</dt></div>
            <div><dd>{capacity.isFull ? "Full" : capacity.availableSlots}</dd><dt>{capacity.isFull ? "Capacity" : capacity.availableSlots === 1 ? "Slot left" : "Slots left"}</dt></div>
          </dl>
          <button type="button" className="faculty-popup-close" onClick={onClose} aria-label="Close modal">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="faculty-popup-body overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/3 animate-pulse" />
              <div className="h-16 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" />
              <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/4 animate-pulse" />
              <div className="h-12 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 text-xs text-rose-700 dark:text-rose-300">
              Unable to load detailed profile credentials at this time. Basic adviser identity and real capacity are displayed above.
            </div>
          ) : (
            <>
              {/* Professional Summary */}
              {profile?.biography && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">About</h3>
                  <p className="text-base text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">
                    {profile.biography}
                  </p>
                </div>
              )}

              {/* Research Mentoring Philosophy */}
              {profile?.mentoringPhilosophy && (
                <div className="rh-panel">
                  <span className="faculty-label">
                    Mentoring Philosophy
                  </span>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                    "{profile.mentoringPhilosophy}"
                  </p>
                </div>
              )}

              {/* Areas of Expertise */}
              {expertiseKeywords.length > 0 && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">Areas of expertise</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {expertiseKeywords.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="faculty-tag"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic Qualifications */}
              {educations.length > 0 && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">Degrees</h3>
                  <div className="divide-y divide-[var(--color-border)]">
                    {educations.map((edu: any, idx: number) => (
                      <div key={edu.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-primary)] dark:text-[var(--color-text-primary)] shrink-0 mt-0.5">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                              {edu.degreeName}
                            </span>
                            {edu.graduationYear && (
                              <span className="text-xs font-bold text-slate-400">
                                ({edu.graduationYear})
                              </span>
                            )}
                          </div>
                          <p className="text-base text-[var(--color-text-secondary)] mt-0.5">
                            {edu.fieldOfStudy} · <span className="font-semibold">{edu.institution}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Research Interests & Topics */}
              {(researchInterests.length > 0 || specializedTopics.length > 0 || profile?.preferredProjectTypes) && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">Research interests</h3>
                  <div className="space-y-3 text-sm">
                    {researchInterests.length > 0 && (
                      <div>
                        <span className="faculty-label">
                          Research Fields
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {researchInterests.map((interest: string, idx: number) => (
                            <Tag key={idx} variant="neutral">{interest}</Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {specializedTopics.length > 0 && (
                      <div>
                        <span className="faculty-label">
                          Specialized Thesis Topics Supervised
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[var(--color-text-primary)]">
                          {specializedTopics.map((topic: string, idx: number) => (
                            <li key={idx}>{topic}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {profile?.preferredProjectTypes && (
                      <div>
                        <span className="faculty-label">
                          Preferred Project Types
                        </span>
                        <p className="text-[var(--color-text-primary)]">{profile.preferredProjectTypes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Experience */}
              {experiences.length > 0 && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">Experience</h3>
                  <div className="space-y-2">
                    {experiences.map((exp: any, idx: number) => (
                      <div
                        key={exp.id || idx}
                        className="rounded-[11px] bg-[var(--color-surface-subtle)] p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-[var(--color-text-primary)]">{exp.title}</span>
                            <p className="text-[var(--color-text-secondary)]">{exp.organization}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                            {exp.startYear} – {exp.isCurrent ? "Present" : exp.endYear || ""}
                          </span>
                        </div>
                        {exp.description && (
                          <p className="mt-1 text-[var(--color-text-secondary)] leading-relaxed text-base">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Publications */}
              {publications.length > 0 && (
                <div className="rh-panel gap-2.5">
                  <h3 className="faculty-title">Publications</h3>
                  <div className="space-y-2">
                    {publications.map((pub: any, idx: number) => (
                      <div
                        key={pub.id || idx}
                        className="rounded-[11px] bg-[var(--color-surface-subtle)] p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[var(--color-text-primary)]">{pub.title}</p>
                          {pub.year && <span className="text-slate-400 font-bold">{pub.year}</span>}
                        </div>
                        <p className="text-[var(--color-text-secondary)] mt-0.5">{pub.venue}</p>
                        {pub.authors && <p className="text-slate-500 text-base mt-0.5">{pub.authors}</p>}
                        {pub.url && (
                          <a
                            href={pub.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] dark:text-[var(--color-text-primary)] mt-1 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Read Paper
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications & Awards */}
              {(certifications.length > 0 || awards.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {certifications.length > 0 && (
                    <div className="rh-panel gap-2.5">
                      <h3 className="faculty-title">Certifications</h3>
                      <div className="divide-y divide-[var(--color-border)] text-sm">
                        {certifications.map((cert: any, idx: number) => (
                          <div key={cert.id || idx} className="py-1.5 first:pt-0 last:pb-0">
                            <p className="font-bold text-[var(--color-text-primary)]">{cert.title}</p>
                            <p className="text-base text-slate-500">
                              {cert.issuingBody} {cert.yearIssued ? `(${cert.yearIssued})` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {awards.length > 0 && (
                    <div className="rh-panel gap-2.5">
                      <h3 className="faculty-title">Awards</h3>
                      <div className="divide-y divide-[var(--color-border)] text-sm">
                        {awards.map((award: any, idx: number) => (
                          <div key={award.id || idx} className="py-1.5 first:pt-0 last:pb-0">
                            <p className="font-bold text-[var(--color-text-primary)]">{award.title}</p>
                            <p className="text-base text-slate-500">
                              {award.issuingOrganization} {award.year ? `(${award.year})` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Advising Preferences */}
              {profile?.advisingPreferences && (
                <div className="rh-panel gap-1">
                  <span className="faculty-title">
                    Advising preferences
                  </span>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line leading-relaxed">
                    {profile.advisingPreferences}
                  </p>
                </div>
              )}

              {/* Polite Empty State if adviser has not populated optional credentials */}
              {!hasExtendedContent && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-slate-50/50 dark:bg-white/5 p-6 text-center space-y-2">
                  <GraduationCap className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-base font-bold text-[var(--color-text-primary)]">
                    Academic CV not yet populated
                  </p>
                  <p className="text-base text-slate-500 max-w-sm mx-auto leading-relaxed">
                    This adviser has not yet added optional CV sections (education, publications, and expertise). Their verified faculty affiliation and real-time advising capacity are shown above.
                  </p>
                </div>
              )}

              {/* Verified Badge Meaning & Self-Reported Credential Disclaimer */}
              <div className="pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                <p className="leading-relaxed">
                  Academic qualifications, publications, and achievements are self-reported by faculty. The <span className="font-semibold text-[var(--color-text-secondary)]">Verified Adviser</span> badge confirms an active, authorized institutional faculty account at University of the Assumption.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Sticky Bottom Action Footer */}
        <div className="faculty-popup-foot">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {canRequest && onRequestAdviser && (
            <Button
              variant="primary"
              size="sm"
              disabled={capacity.isFull || !capacity.isAcceptingAdvisees}
              onClick={handleRequestClick}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
            >
              {!capacity.isAcceptingAdvisees
                ? "Requests Paused"
                : capacity.isFull
                ? "Capacity Full"
                : "Request Adviser"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
