"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Sparkles, ExternalLink } from "lucide-react";
import { useFacultyProfile } from "@/hooks/use-faculty-profile";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { ProgressRing, progressTone } from "@/components/dashboards/RoleHomeParts";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import "./faculty-profile.css";
import { Modal } from "@/components/ui/Modal";

export function AdviserFacultyProfileView() {
  const router = useRouter();
  const {
    profile,
    profileUser,
    capacity,
    completion,
    isLoading,
    getLegacyLocalStorageData,
    dismissLegacyData,
  } = useFacultyProfile();

  const [legacyData, setLegacyData] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    const legacy = getLegacyLocalStorageData();
    if (legacy) {
      setLegacyData(legacy);
    }
  }, [getLegacyLocalStorageData]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const fullName = profileUser
    ? `${profileUser.firstName || ""} ${profileUser.lastName || ""}`.trim()
    : "Faculty Adviser";

  const initials = profileUser
    ? `${profileUser.firstName?.[0] || "F"}${profileUser.lastName?.[0] || "A"}`.toUpperCase()
    : "FA";

  const academicTitle = profile?.academicTitle?.trim() || "";
  const facultyDesignation = profile?.facultyDesignation?.trim() || "Faculty Research Adviser";
  const department = profile?.department?.trim() || profileUser?.program?.name || "Department of Information Technology";
  const collegeName = profileUser?.college?.name || "College of Computing";

  const educations = Array.isArray(profile?.educations) ? profile!.educations : [];
  const experiences = Array.isArray(profile?.experiences) ? profile!.experiences : [];
  const certifications = Array.isArray(profile?.certifications) ? profile!.certifications : [];
  const publications = Array.isArray(profile?.publications) ? profile!.publications : [];
  const awards = Array.isArray(profile?.awards) ? profile!.awards : [];
  const expertiseKeywords = Array.isArray(profile?.expertiseKeywords) ? profile!.expertiseKeywords : [];
  const researchInterests = Array.isArray(profile?.researchInterests) ? profile!.researchInterests : [];
  const specializedTopics = Array.isArray(profile?.specializedTopics) ? profile!.specializedTopics : [];

  const completionPercentage = completion?.percentage ?? 0;
  const suggestions = completion?.suggestions ?? [];

  return (
    <div className="rs faculty-scope w-full">
      <RoleBand
        eyebrow="Faculty profile · Verified adviser"
        title={academicTitle ? `${academicTitle} ${fullName}` : fullName}
        titleId="faculty-profile-title"
        meta={[facultyDesignation, department, collegeName].filter(Boolean).join(" · ")}
        counts={[
          ...(capacity
            ? [
                { label: "Groups", value: `${capacity.adviseeCount} of ${capacity.maxAdviseeGroups}` },
                { label: "Slots left", value: capacity.availableSlots, tone: capacity.isFull ? ("waiting" as const) : undefined },
              ]
            : []),
          { label: "Complete", value: `${completionPercentage}%` },
        ]}
        countsLabel="Faculty profile summary"
        primary={{ label: "Edit profile", icon: "ti-edit", onClick: () => router.push("/adviser/profile/edit") }}
        secondary={[{ label: "Preview student view", icon: "ti-eye", onClick: () => setIsPreviewOpen(true) }]}
      />
      {/* Controlled Legacy localStorage Migration Banner */}
      {legacyData && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 dark:bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                Draft Profile Details Found On This Device
              </h4>
              <p className="text-base text-amber-700 dark:text-amber-300 mt-0.5">
                We detected earlier profile information stored locally in your browser. Would you like to review and save it to your official faculty profile?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                dismissLegacyData();
                setLegacyData(null);
              }}
              className="text-sm"
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/adviser/profile/edit?importLegacy=true")}
              className="text-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
            >
              Review & Import
            </Button>
          </div>
        </div>
      )}

      {(completionPercentage < 100 || suggestions.length > 0) && (
        <div className="faculty-meter">
          <ProgressRing value={completionPercentage} tone={progressTone(completionPercentage)} />
          <div className="faculty-meter-text">
            <strong>{completionPercentage >= 85 ? "Your profile is nearly complete" : "Add a little more so students can find the right match"}</strong>
            <span>Profile completion is for student guidance only. Your verified adviser status and ability to receive research group requests are not restricted.</span>
          </div>
          {suggestions.length > 0 && (
            <div className="faculty-suggestions">
              {suggestions.slice(0, 3).map((suggestion, idx) => <span key={idx}>{suggestion}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Academic CV Content Grid */}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
        {/* Left Column (2 Cols): Bio, Qualifications, Experience, Publications */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* Professional Summary & Biography */}
          <section className="rh-panel faculty-card">
            <h2 className="faculty-title">About</h2>
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <span className="faculty-label">
                  Faculty Biography
                </span>
                <p className="text-[var(--color-text-primary)] whitespace-pre-line">
                  {profile?.biography || "No professional biography added yet. Click 'Edit Profile' to introduce yourself to prospective advisees."}
                </p>
              </div>

              {profile?.teachingBackground && (
                <div>
                  <span className="faculty-label">
                    Teaching Background
                  </span>
                  <p className="text-[var(--color-text-primary)] whitespace-pre-line">
                    {profile.teachingBackground}
                  </p>
                </div>
              )}

              {profile?.mentoringPhilosophy && (
                <div>
                  <span className="faculty-label">
                    Research Mentoring Philosophy
                  </span>
                  <p className="text-[var(--color-text-primary)] border-l-2 border-[var(--color-primary)] pl-3 py-1">
                    "{profile.mentoringPhilosophy}"
                  </p>
                </div>
              )}

              {profile?.preferredProjectTypes && (
                <div>
                  <span className="faculty-label">
                    Preferred Types of Research Projects
                  </span>
                  <p className="text-[var(--color-text-primary)]">
                    {profile.preferredProjectTypes}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Academic Qualifications */}
          <section className="rh-panel faculty-card">
            <h2 className="faculty-title">Degrees</h2>
            {educations.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {educations.map((edu, idx) => (
                  <div key={edu.id || idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-primary)] dark:text-[var(--color-text-primary)] shrink-0 mt-0.5">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
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
            ) : (
              <p className="text-sm text-slate-500 italic py-2">
                No academic degrees entered yet.
              </p>
            )}
          </section>

          {/* Professional & Academic Experience */}
          <section className="rh-panel faculty-card">
            <h2 className="faculty-title">Experience</h2>
            {experiences.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {experiences.map((exp, idx) => (
                  <div key={exp.id || idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {exp.title}
                          </span>
                          <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
                            {exp.type}
                          </span>
                        </div>
                        <p className="text-base font-medium text-[var(--color-text-secondary)] mt-0.5">
                          {exp.organization}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                        {exp.startYear} – {exp.isCurrent ? "Present" : exp.endYear || ""}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-base text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic py-2">
                No teaching or industry positions added yet.
              </p>
            )}
          </section>

          {/* Publications & Research Contributions */}
          {publications.length > 0 && (
            <section className="rh-panel faculty-card">
              <h2 className="faculty-title">Publications</h2>
              <div className="space-y-3">
                {publications.map((pub, idx) => (
                  <div key={pub.id || idx} className="p-3 rounded-xl bg-[var(--color-surface-subtle)] text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        {pub.title}
                      </p>
                      {pub.year && <span className="font-bold text-slate-400">{pub.year}</span>}
                    </div>
                    <p className="text-[var(--color-text-secondary)] mt-0.5 italic">
                      {pub.venue}
                    </p>
                    {pub.authors && <p className="text-slate-500 mt-0.5">{pub.authors}</p>}
                    {pub.url && (
                      <a
                        href={pub.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] dark:text-[var(--color-text-primary)] mt-1.5 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Publication
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (1 Col): Expertise, Research Interests, Certifications, Awards, Advising Preferences */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* Areas of Expertise */}
          <section className="rh-panel faculty-card">
            <h2 className="faculty-title">Areas of expertise</h2>
            {expertiseKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {expertiseKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="faculty-tag"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No expertise specialties selected yet.</p>
            )}
          </section>

          {/* Research Interests & Topics */}
          <section className="rh-panel faculty-card">
            <h2 className="faculty-title">Research interests</h2>
            <div className="space-y-3 text-sm">
              {researchInterests.length > 0 && (
                <div>
                  <span className="faculty-label">
                    Preferred Research Fields
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {researchInterests.map((item, idx) => (
                      <Tag key={idx} variant="neutral">{item}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {specializedTopics.length > 0 && (
                <div>
                  <span className="faculty-label">
                    Specialized Thesis Topics
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[var(--color-text-primary)]">
                    {specializedTopics.map((topic, idx) => (
                      <li key={idx}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile?.supervisionMethodologies?.length ? (
                <div>
                  <span className="faculty-label">
                    Technologies & Methodologies Supervised
                  </span>
                  <p className="text-[var(--color-text-primary)]">
                    {profile.supervisionMethodologies.join(", ")}
                  </p>
                </div>
              ) : null}

              {profile?.acceptedResearchTypes?.length ? (
                <div>
                  <span className="faculty-label">
                    Accepted Research Types
                  </span>
                  <p className="text-[var(--color-text-primary)]">
                    {profile.acceptedResearchTypes.join(", ")}
                  </p>
                </div>
              ) : null}

              {!researchInterests.length && !specializedTopics.length && (
                <p className="text-sm text-slate-500 italic">No specific research topics defined yet.</p>
              )}
            </div>
          </section>

          {/* Certifications & Licenses */}
          {certifications.length > 0 && (
            <section className="rh-panel faculty-card">
              <h2 className="faculty-title">Certifications</h2>
              <div className="divide-y divide-[var(--color-border)]">
                {certifications.map((cert, idx) => (
                  <div key={cert.id || idx} className="py-2 first:pt-0 last:pb-0 text-sm">
                    <p className="font-semibold text-[var(--color-text-primary)]">{cert.title}</p>
                    <p className="text-slate-500">
                      {cert.issuingBody} {cert.yearIssued ? `(${cert.yearIssued})` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Awards & Achievements */}
          {awards.length > 0 && (
            <section className="rh-panel faculty-card">
              <h2 className="faculty-title">Awards</h2>
              <div className="space-y-2">
                {awards.map((award, idx) => (
                  <div key={award.id || idx} className="text-sm">
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      {award.title} {award.year ? `(${award.year})` : ""}
                    </p>
                    <p className="text-slate-500">{award.issuingOrganization}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Advising Preferences */}
          {profile?.advisingPreferences && (
            <section className="rh-panel faculty-card">
              <h2 className="faculty-title">Advising preferences</h2>
              <p className="text-base text-[var(--color-text-primary)] whitespace-pre-line leading-relaxed">
                {profile.advisingPreferences}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Student View Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Student View Preview"
        subtitle="This is exactly how prospective students see your academic CV modal."
        maxWidth="lg"
      >
        <div className="space-y-5 text-xs text-[var(--color-text-primary)]">
          <div className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center gap-3">
            <Avatar initials={initials} name={fullName} size="lg" colorVariant="accent" />
            <div>
              <p className="font-semibold text-base text-[var(--color-text-primary)]">
                {academicTitle ? `${academicTitle} ${fullName}` : fullName}
              </p>
              <p className="text-base text-[var(--color-text-secondary)] font-bold">{facultyDesignation} · {department}</p>
              <p className="text-base text-slate-500">{profileUser?.email}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[var(--color-text-primary)] uppercase tracking-wider text-lg mb-1">
              Biography
            </h4>
            <p className="leading-relaxed">
              {profile?.biography || "No biography provided yet."}
            </p>
          </div>

          {educations.length > 0 && (
            <div>
              <h4 className="font-semibold text-[var(--color-text-primary)] uppercase tracking-wider text-lg mb-1.5">
                Academic Qualifications
              </h4>
              <ul className="space-y-1">
                {educations.map((edu, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                    <span>{edu.degreeName} ({edu.institution}{edu.graduationYear ? `, ${edu.graduationYear}` : ""})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expertiseKeywords.length > 0 && (
            <div>
              <h4 className="font-semibold text-[var(--color-text-primary)] uppercase tracking-wider text-lg mb-1.5">
                Specialties
              </h4>
              <div className="flex flex-wrap gap-1">
                {expertiseKeywords.map((kw, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-xs bg-[var(--color-surface-subtle)] font-semibold">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
