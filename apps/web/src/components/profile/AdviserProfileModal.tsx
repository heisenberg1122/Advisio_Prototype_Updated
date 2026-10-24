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
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#101b2b] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-[#C9A227]">
            <GraduationCap className="h-4 w-4" />
            <span className="uppercase tracking-widest text-xs">Faculty Academic Profile</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 pb-5 border-b border-slate-100 dark:border-white/10">
            <Avatar
              initials={adviser.initials}
              name={fullName}
              src={profile?.photoUrl || undefined}
              size="xl"
              colorVariant={adviser.colorVariant || "accent"}
              className="w-16 h-16 sm:w-20 sm:h-20 text-xl font-black shadow-sm shrink-0 border-2 border-white dark:border-[#101b2b]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="adviser-cv-title" className="text-xl sm:text-2xl font-extrabold text-[#17212B] dark:text-white">
                  {academicTitle ? `${academicTitle} ${fullName}` : fullName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified Adviser
                </span>
              </div>

              <p className="text-base font-bold text-[#C9A227] mt-1">
                {facultyDesignation} {department ? `· ${department}` : ""}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{collegeName}</span>
                {email && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Real-time Advising Capacity Meter */}
          <div className="rounded-xl bg-slate-50/80 dark:bg-white/5 p-4 border border-slate-200/80 dark:border-white/10">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Current Advising Capacity
              </span>
              <span className={capacity.isFull ? "text-rose-600" : "text-emerald-600 font-extrabold"}>
                {capacity.isFull ? "Capacity Full" : `${capacity.availableSlots} ${capacity.availableSlots === 1 ? "slot" : "slots"} available`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  capacity.isFull ? "bg-rose-500" : "bg-[#0B3A53] dark:bg-[#C9A227]"
                }`}
                style={{
                  width: `${Math.min(100, capacity.maxAdviseeGroups ? (capacity.adviseeCount / capacity.maxAdviseeGroups) * 100 : 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>{capacity.adviseeCount} active research groups</span>
              <span>Max allowed: {capacity.maxAdviseeGroups} groups</span>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4 py-6">
              <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/3 animate-pulse" />
              <div className="h-16 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
              <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/4 animate-pulse" />
              <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 text-xs text-rose-700 dark:text-rose-300">
              Unable to load detailed profile credentials at this time. Basic adviser identity and real capacity are displayed above.
            </div>
          ) : (
            <>
              {/* Professional Summary */}
              {profile?.biography && (
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    Faculty Biography
                  </h3>
                  <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {profile.biography}
                  </p>
                </div>
              )}

              {/* Research Mentoring Philosophy */}
              {profile?.mentoringPhilosophy && (
                <div className="rounded-xl border-l-3 border-[#C9A227] bg-slate-50/70 dark:bg-white/5 p-3.5 text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-xs block mb-1">
                    Mentoring Philosophy
                  </span>
                  <p className="italic text-slate-800 dark:text-slate-200 leading-relaxed">
                    "{profile.mentoringPhilosophy}"
                  </p>
                </div>
              )}

              {/* Areas of Expertise */}
              {expertiseKeywords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <Award className="h-4 w-4" />
                    Areas of Expertise
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {expertiseKeywords.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#0B3A53]/5 dark:bg-[#C9A227]/10 text-[#0B3A53] dark:text-[#C9A227] border border-[#0B3A53]/15 dark:border-[#C9A227]/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Academic Qualifications */}
              {educations.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" />
                    Academic Qualifications & Degrees
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-[#101b2b]">
                    {educations.map((edu: any, idx: number) => (
                      <div key={edu.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-[#0B3A53] dark:text-[#C9A227] shrink-0 mt-0.5">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {edu.degreeName}
                            </span>
                            {edu.graduationYear && (
                              <span className="text-xs font-bold text-slate-400">
                                ({edu.graduationYear})
                              </span>
                            )}
                          </div>
                          <p className="text-base text-slate-600 dark:text-slate-300 mt-0.5">
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
                <div className="space-y-2.5">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4" />
                    Research Interests & Thesis Topics
                  </h3>
                  <div className="p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 space-y-3 text-xs">
                    {researchInterests.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
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
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                          Specialized Thesis Topics Supervised
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                          {specializedTopics.map((topic: string, idx: number) => (
                            <li key={idx}>{topic}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {profile?.preferredProjectTypes && (
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-0.5">
                          Preferred Project Types
                        </span>
                        <p className="text-slate-700 dark:text-slate-300">{profile.preferredProjectTypes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Experience */}
              {experiences.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    Teaching & Industry Experience
                  </h3>
                  <div className="space-y-2">
                    {experiences.map((exp: any, idx: number) => (
                      <div
                        key={exp.id || idx}
                        className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#101b2b] text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white">{exp.title}</span>
                            <p className="text-slate-600 dark:text-slate-400">{exp.organization}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                            {exp.startYear} – {exp.isCurrent ? "Present" : exp.endYear || ""}
                          </span>
                        </div>
                        {exp.description && (
                          <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed text-base">
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
                <div className="space-y-2.5">
                  <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Publications & Research Contributions
                  </h3>
                  <div className="space-y-2">
                    {publications.map((pub: any, idx: number) => (
                      <div
                        key={pub.id || idx}
                        className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#101b2b] text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-extrabold text-slate-900 dark:text-white">{pub.title}</p>
                          {pub.year && <span className="text-slate-400 font-bold">{pub.year}</span>}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 italic mt-0.5">{pub.venue}</p>
                        {pub.authors && <p className="text-slate-500 text-base mt-0.5">{pub.authors}</p>}
                        {pub.url && (
                          <a
                            href={pub.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-bold text-[#0B3A53] dark:text-[#C9A227] mt-1 hover:underline"
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
                    <div>
                      <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Certifications & Licenses
                      </h3>
                      <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#101b2b] divide-y divide-slate-100 dark:divide-white/5 text-xs">
                        {certifications.map((cert: any, idx: number) => (
                          <div key={cert.id || idx} className="py-1.5 first:pt-0 last:pb-0">
                            <p className="font-bold text-slate-900 dark:text-white">{cert.title}</p>
                            <p className="text-base text-slate-500">
                              {cert.issuingBody} {cert.yearIssued ? `(${cert.yearIssued})` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {awards.length > 0 && (
                    <div>
                      <h3 className="text-lg font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5 mb-2">
                        <Award className="h-4 w-4" />
                        Awards & Achievements
                      </h3>
                      <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#101b2b] divide-y divide-slate-100 dark:divide-white/5 text-xs">
                        {awards.map((award: any, idx: number) => (
                          <div key={award.id || idx} className="py-1.5 first:pt-0 last:pb-0">
                            <p className="font-bold text-slate-900 dark:text-white">{award.title}</p>
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
                <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-xs space-y-1">
                  <span className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] uppercase tracking-wider text-xs block">
                    Advising Guidelines & Group Preferences
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {profile.advisingPreferences}
                  </p>
                </div>
              )}

              {/* Polite Empty State if adviser has not populated optional credentials */}
              {!hasExtendedContent && (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-6 text-center space-y-2">
                  <GraduationCap className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                    Academic CV not yet populated
                  </p>
                  <p className="text-base text-slate-500 max-w-sm mx-auto leading-relaxed">
                    This adviser has not yet added optional CV sections (education, publications, and expertise). Their verified faculty affiliation and real-time advising capacity are shown above.
                  </p>
                </div>
              )}

              {/* Verified Badge Meaning & Self-Reported Credential Disclaimer */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-slate-500 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                <p className="leading-relaxed">
                  Academic qualifications, publications, and achievements are self-reported by faculty. The <span className="font-semibold text-slate-600 dark:text-slate-300">Verified Adviser</span> badge confirms an active, authorized institutional faculty account at University of the Assumption.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Sticky Bottom Action Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 flex items-center justify-between gap-3 shrink-0">
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
