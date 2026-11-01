"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mail,
  Building2,
  Award,
  Edit3,
  Phone,
  CheckCircle2,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import "./profile-workspace.css";

export function ProfileCard() {
  const { profile, loading } = useProfile();
  const pathname = usePathname() || "";

  // Get edit URL based on current role path
  let editUrl = "/student/profile/edit";
  if (pathname.includes("/system-admin")) {
    editUrl = "/system-admin/profile/edit";
  } else if (pathname.includes("/admin")) {
    editUrl = "/admin/profile/edit";
  } else if (pathname.includes("/adviser")) {
    editUrl = "/adviser/profile/edit";
  } else if (pathname.includes("/professor")) {
    editUrl = "/professor/profile/edit";
  } else if (pathname.includes("/panelist")) {
    editUrl = "/panelist/profile/edit";
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  const roleLabels: Record<string, string> = {
    student: "Student Researcher",
    adviser: "Faculty Research Adviser",
    professor: "Research Coordinator",
    panelist: "Defense Panelist",
    admin: "Portal Administrator",
    system_admin: "System Administrator",
  };

  return (
    <div className="profile-workspace profile-view">
      {/* Dynamic Profile Header Banner */}
      <Card className="workspace-page-header profile-summary">
        <div className="profile-identity">
          <Avatar
            initials={profile.initials}
            name={profile.name}
            src={profile.photoUrl}
            colorVariant="accent"
            size="xl"
            className="profile-avatar"
          />
          <div className="profile-identity-copy">
            <p className="profile-eyebrow">My profile</p>
            <h1>{profile.name}</h1>
            <div className="profile-role">
              {roleLabels[profile.role] || profile.role}
            </div>
            <div className="profile-tags">
              <Tag variant="success" dot>
                Account Active
              </Tag>
              {profile.college && (
                <Tag variant="neutral">{profile.college}</Tag>
              )}
              {profile.academicYear && (
                <Tag variant="neutral">{profile.academicYear}</Tag>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="profile-summary-action">
          <Link href={editUrl} className="profile-edit-link">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            <span>Edit profile</span>
          </Link>
        </div>
      </Card>

      {/* 3-Column Profile Dashboard Details Grid */}
      <div className="profile-details-grid">
        {/* Column 1: Account Contact Details */}
        <Card className="profile-panel flex flex-col gap-4">
          <h2 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#C9A227]" />
            <span>Contact details</span>
          </h2>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
              Email Address
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">
              {profile.email}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
              Contact Number
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {profile.contactNumber || "Not specified"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
              Portal Status
            </span>
            <span className="font-semibold text-[#2E7D5B] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified Institutional Account
            </span>
          </div>
        </Card>

        {/* Column 2: Institutional Records */}
        <Card className="profile-panel flex flex-col gap-4">
          <h2 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#C9A227]" />
            <span>University details</span>
          </h2>

          {profile.role === "student" ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Student ID Number
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.studentId || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Program / Course
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.program || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Year Level & Section
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.yearLevel || "N/A"}{" "}
                  {profile.section ? ` - Section ${profile.section}` : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Faculty Employee ID
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.employeeId || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Department / Office
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.department || "N/A"}
                </span>
              </div>
              {profile.academicYear && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                    Academic Year Scope
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {profile.academicYear}
                  </span>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Column 3: Specialized Supervision Details */}
        <Card className="profile-panel flex flex-col gap-4">
          <h2 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-lg border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-[#C9A227]" />
            <span>Research details</span>
          </h2>

          {profile.role === "student" && (
            <div className="flex flex-col gap-1 h-full">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                Research Interests
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed bg-[#F7F9FB] dark:bg-white/5 p-3 rounded-xl border border-[#EEF2F6] dark:border-white/10 mt-1">
                {profile.researchInterests || "Not specified yet."}
              </p>
            </div>
          )}

          {profile.role === "adviser" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Areas of Expertise
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.expertise || "Not specified"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Research Specialization
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.specialization || "Not specified"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Availability Hours
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.availability || "Not specified"}
                </span>
              </div>
            </div>
          )}

          {profile.role === "professor" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Research Specialization
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.specialization || "Not specified"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Handled Course Sections
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.subjects || "Not specified"}
                </span>
              </div>
            </div>
          )}

          {profile.role === "panelist" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Research Specialization
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.specialization || "Not specified"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Panel Assignment Details
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.panelDetails || "Not specified"}
                </span>
              </div>
            </div>
          )}

          {(profile.role === "admin" || profile.role === "system_admin") && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Position Title
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.position || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-xs">
                  Access Scope
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                  {profile.role.replace("_", " ")} Authorization
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
