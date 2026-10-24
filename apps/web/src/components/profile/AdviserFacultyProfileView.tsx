"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Building2,
  Award,
  Edit3,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Briefcase,
  FileText,
  Lightbulb,
  AlertCircle,
  ExternalLink,
  Eye,
  Info,
  Sparkles,
} from "lucide-react";
import { useFacultyProfile } from "@/hooks/use-faculty-profile";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
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
    <div className="flex flex-col gap-6 w-full">
      {/* Controlled Legacy localStorage Migration Banner */}
      {legacyData && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 dark:bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-extrabold text-amber-900 dark:text-amber-200">
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

      {/* Profile Completion Guidance Banner */}
      <Card className="p-5 sm:p-6 border border-[#DDE3E8] dark:border-white/10 bg-gradient-to-r from-white via-white to-[#F4F8FA] dark:from-[#101b2b] dark:to-[#0B1522] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" />
                Professional Profile Completion — {completionPercentage}%
              </span>
              <span className="text-xs font-bold text-slate-500">
                {completionPercentage >= 85 ? "Well Formatted CV" : "Guidance Suggestions Available"}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#0B3A53] to-[#C9A227] transition-all duration-500 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Suggested additions:</span>
                {suggestions.slice(0, 3).map((suggestion, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/10"
                  >
                    <Info className="h-3 w-3 text-[#C9A227]" />
                    {suggestion}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-slate-400 italic">
              Note: Profile completion is for student guidance only. Your verified adviser status and ability to receive research group requests are not restricted.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen(true)}
              icon={<Eye className="h-4 w-4" />}
            >
              Preview Student View
            </Button>
            <Link href="/adviser/profile/edit">
              <Button
                variant="primary"
                size="sm"
                icon={<Edit3 className="h-4 w-4" />}
              >
                Edit Profile
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Professional Header Banner */}
      <Card className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 sm:p-8 bg-white dark:bg-[#101b2b] relative overflow-hidden border border-[#DDE3E8] dark:border-white/10 shadow-[0_1px_3px_0_rgba(11,58,83,0.04)]">
        {/* Decorative UA Gold Corner Accent */}
        <div className="absolute right-0 top-0 w-36 h-36 bg-[#C9A227]/10 rounded-bl-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-5 z-10 text-center sm:text-left">
          <Avatar
            initials={initials}
            name={fullName}
            src={profile?.photoUrl || undefined}
            colorVariant="accent"
            size="xl"
            className="w-20 h-20 text-2xl font-black shadow-md border-4 border-white dark:border-[#101b2b]"
          />
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#17212B] dark:text-white">
                {academicTitle ? `${academicTitle} ${fullName}` : fullName}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified Adviser
              </span>
            </div>

            <div className="text-xs sm:text-sm font-bold text-[#C9A227] mt-1">
              {facultyDesignation} {department ? `· ${department}` : ""}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3 text-xs text-slate-500">
              <Tag variant="neutral">{collegeName}</Tag>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {profileUser?.email}
              </span>
            </div>
          </div>
        </div>

        {/* Live Advising Capacity Metric Pill */}
        {capacity && (
          <div className="z-10 shrink-0 w-full md:w-64 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-600 dark:text-slate-300">Advising Capacity</span>
              <span className={capacity.isFull ? "text-rose-600" : "text-emerald-600"}>
                {capacity.availableSlots} {capacity.availableSlots === 1 ? "slot" : "slots"} left
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
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{capacity.adviseeCount} active groups</span>
              <span>Max: {capacity.maxAdviseeGroups}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Academic CV Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Bio, Qualifications, Experience, Publications */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Professional Summary & Biography */}
          <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
            <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
              <BookOpen className="h-4 w-4 text-[#C9A227]" />
              Professional Summary & Mentoring Philosophy
            </h3>
            <div className="space-y-4 text-xs sm:text-[13px] leading-relaxed">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                  Faculty Biography
                </span>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line">
                  {profile?.biography || "No professional biography added yet. Click 'Edit Profile' to introduce yourself to prospective advisees."}
                </p>
              </div>

              {profile?.teachingBackground && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Teaching Background
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {profile.teachingBackground}
                  </p>
                </div>
              )}

              {profile?.mentoringPhilosophy && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Research Mentoring Philosophy
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 italic border-l-2 border-[#C9A227] pl-3 py-1">
                    "{profile.mentoringPhilosophy}"
                  </p>
                </div>
              )}

              {profile?.preferredProjectTypes && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Preferred Types of Research Projects
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {profile.preferredProjectTypes}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Academic Qualifications */}
          <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
            <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
              <GraduationCap className="h-4 w-4 text-[#C9A227]" />
              Academic Qualifications & Degrees
            </h3>
            {educations.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {educations.map((edu, idx) => (
                  <div key={edu.id || idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-[#0B3A53] dark:text-[#C9A227] shrink-0 mt-0.5">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white">
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
            ) : (
              <p className="text-sm text-slate-500 italic py-2">
                No academic degrees entered yet.
              </p>
            )}
          </Card>

          {/* Professional & Academic Experience */}
          <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
            <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
              <Briefcase className="h-4 w-4 text-[#C9A227]" />
              Professional & Academic Experience
            </h3>
            {experiences.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {experiences.map((exp, idx) => (
                  <div key={exp.id || idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white">
                            {exp.title}
                          </span>
                          <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {exp.type}
                          </span>
                        </div>
                        <p className="text-base font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                          {exp.organization}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                        {exp.startYear} – {exp.isCurrent ? "Present" : exp.endYear || ""}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-base text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
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
          </Card>

          {/* Publications & Research Contributions */}
          {publications.length > 0 && (
            <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
              <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                <FileText className="h-4 w-4 text-[#C9A227]" />
                Publications & Conference Presentations
              </h3>
              <div className="space-y-3">
                {publications.map((pub, idx) => (
                  <div key={pub.id || idx} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {pub.title}
                      </p>
                      {pub.year && <span className="font-bold text-slate-400">{pub.year}</span>}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5 italic">
                      {pub.venue}
                    </p>
                    {pub.authors && <p className="text-slate-500 mt-0.5">{pub.authors}</p>}
                    {pub.url && (
                      <a
                        href={pub.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#0B3A53] dark:text-[#C9A227] mt-1.5 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Publication
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (1 Col): Expertise, Research Interests, Certifications, Awards, Advising Preferences */}
        <div className="flex flex-col gap-6">
          {/* Areas of Expertise */}
          <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-3">
            <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
              <Award className="h-4 w-4 text-[#C9A227]" />
              Areas of Expertise
            </h3>
            {expertiseKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {expertiseKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#0B3A53]/5 dark:bg-[#C9A227]/10 text-[#0B3A53] dark:text-[#C9A227] border border-[#0B3A53]/15 dark:border-[#C9A227]/20"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No expertise specialties selected yet.</p>
            )}
          </Card>

          {/* Research Interests & Topics */}
          <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-3">
            <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
              <Lightbulb className="h-4 w-4 text-[#C9A227]" />
              Research Interests & Topics
            </h3>
            <div className="space-y-3 text-xs">
              {researchInterests.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
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
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Specialized Thesis Topics
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    {specializedTopics.map((topic, idx) => (
                      <li key={idx}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile?.supervisionMethodologies?.length ? (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Technologies & Methodologies Supervised
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {profile.supervisionMethodologies.join(", ")}
                  </p>
                </div>
              ) : null}

              {profile?.acceptedResearchTypes?.length ? (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs block mb-1">
                    Accepted Research Types
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {profile.acceptedResearchTypes.join(", ")}
                  </p>
                </div>
              ) : null}

              {!researchInterests.length && !specializedTopics.length && (
                <p className="text-sm text-slate-500 italic">No specific research topics defined yet.</p>
              )}
            </div>
          </Card>

          {/* Certifications & Licenses */}
          {certifications.length > 0 && (
            <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-3">
              <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
                Certifications & Licenses
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {certifications.map((cert, idx) => (
                  <div key={cert.id || idx} className="py-2 first:pt-0 last:pb-0 text-xs">
                    <p className="font-extrabold text-slate-900 dark:text-white">{cert.title}</p>
                    <p className="text-slate-500">
                      {cert.issuingBody} {cert.yearIssued ? `(${cert.yearIssued})` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Awards & Achievements */}
          {awards.length > 0 && (
            <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-3">
              <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                <Award className="h-4 w-4 text-[#C9A227]" />
                Awards & Achievements
              </h3>
              <div className="space-y-2">
                {awards.map((award, idx) => (
                  <div key={award.id || idx} className="text-xs">
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {award.title} {award.year ? `(${award.year})` : ""}
                    </p>
                    <p className="text-slate-500">{award.issuingOrganization}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Advising Preferences */}
          {profile?.advisingPreferences && (
            <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-3">
              <h3 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
                <Building2 className="h-4 w-4 text-[#C9A227]" />
                Advising Preferences & Guidelines
              </h3>
              <p className="text-base text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {profile.advisingPreferences}
              </p>
            </Card>
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
        <div className="space-y-5 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3">
            <Avatar initials={initials} name={fullName} size="lg" colorVariant="accent" />
            <div>
              <p className="font-extrabold text-base text-slate-900 dark:text-white">
                {academicTitle ? `${academicTitle} ${fullName}` : fullName}
              </p>
              <p className="text-base text-[#C9A227] font-bold">{facultyDesignation} · {department}</p>
              <p className="text-base text-slate-500">{profileUser?.email}</p>
            </div>
          </div>

          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-lg mb-1">
              Biography
            </h4>
            <p className="leading-relaxed">
              {profile?.biography || "No biography provided yet."}
            </p>
          </div>

          {educations.length > 0 && (
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-lg mb-1.5">
                Academic Qualifications
              </h4>
              <ul className="space-y-1">
                {educations.map((edu, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-[#C9A227]" />
                    <span>{edu.degreeName} ({edu.institution}{edu.graduationYear ? `, ${edu.graduationYear}` : ""})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expertiseKeywords.length > 0 && (
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-lg mb-1.5">
                Specialties
              </h4>
              <div className="flex flex-wrap gap-1">
                {expertiseKeywords.map((kw, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-white/10 font-semibold">
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
