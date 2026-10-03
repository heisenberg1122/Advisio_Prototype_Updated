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
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";

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
    return (
      <div className="flex flex-col gap-6 w-full animate-pulse">
        <div className="h-36 bg-white dark:bg-[#101b2b] rounded-2xl border border-[#DDE3E8] p-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white dark:bg-[#101b2b] rounded-2xl border border-[#DDE3E8] p-6" />
          ))}
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    student: "Student Researcher",
    adviser: "Faculty Research Adviser",
    professor: "Professor / Research Supervisor",
    panelist: "Defense Panelist",
    admin: "Portal Administrator",
    system_admin: "System Administrator",
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Dynamic Profile Header Banner */}
      <Card className="flex flex-col sm:flex-row items-center justify-between gap-5 p-6 sm:p-8 bg-gradient-to-r from-white via-white to-[#EAF3F7]/50 dark:from-[#101b2b] dark:to-[#080E18] relative overflow-hidden border border-[#DDE3E8] dark:border-white/10 shadow-[0_1px_3px_0_rgba(11,58,83,0.04)]">
        {/* Decorative UA Gold Corner Accent */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-[#C9A227]/10 rounded-bl-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-5 z-10 text-center sm:text-left">
          <Avatar
            initials={profile.initials}
            colorVariant="accent"
            size="xl"
            className="w-16 h-16 sm:w-20 sm:h-20 text-xl font-black shadow-md border-4 border-white dark:border-[#101b2b]"
          />
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#17212B] dark:text-white">
              {profile.name}
            </h2>
            <div className="text-xs sm:text-sm font-bold text-[#C9A227] mt-0.5">
              {roleLabels[profile.role] || profile.role}
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
              <Tag variant="success" dot>Account Active</Tag>
              {profile.college && <Tag variant="neutral">{profile.college}</Tag>}
              {profile.academicYear && <Tag variant="neutral">{profile.academicYear}</Tag>}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="z-10 shrink-0">
          <Link
            href={editUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B3A53] hover:bg-[#072A3D] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Edit3 className="h-4 w-4 text-[#C9A227]" />
            <span>Edit Profile Details</span>
          </Link>
        </div>
      </Card>

      {/* 3-Column Profile Dashboard Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[13px]">
        {/* Column 1: Account Contact Details */}
        <Card className="flex flex-col gap-4 border border-[#DDE3E8] dark:border-white/10 shadow-sm h-full">
          <h4 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-sm border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#C9A227]" />
            <span>Account Contact Info</span>
          </h4>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Email Address</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">{profile.email}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Contact Number</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.contactNumber || "Not specified"}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Portal Status</span>
            <span className="font-semibold text-[#2E7D5B] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified Institutional Account
            </span>
          </div>
        </Card>

        {/* Column 2: Institutional Records */}
        <Card className="flex flex-col gap-4 border border-[#DDE3E8] dark:border-white/10 shadow-sm h-full">
          <h4 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-sm border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#C9A227]" />
            <span>Institutional Records</span>
          </h4>

          {profile.role === "student" ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Student ID Number</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.studentId || "N/A"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Program / Course</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.program || "N/A"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Year Level & Section</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile.yearLevel || "N/A"} {profile.section ? ` - Section ${profile.section}` : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Faculty Employee ID</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.employeeId || "N/A"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Department / Office</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.department || "N/A"}</span>
              </div>
              {profile.academicYear && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Academic Year Scope</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.academicYear}</span>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Column 3: Specialized Supervision Details */}
        <Card className="flex flex-col gap-4 border border-[#DDE3E8] dark:border-white/10 shadow-sm h-full">
          <h4 className="font-extrabold text-[#0B3A53] dark:text-[#C9A227] text-sm border-b border-[#EEF2F6] dark:border-white/10 pb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-[#C9A227]" />
            <span>Specialized Details</span>
          </h4>

          {profile.role === "student" && (
            <div className="flex flex-col gap-1 h-full">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Research Interests</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed bg-[#F7F9FB] dark:bg-white/5 p-3 rounded-xl border border-[#EEF2F6] dark:border-white/10 mt-1">
                {profile.researchInterests || "Not specified yet."}
              </p>
            </div>
          )}

          {profile.role === "adviser" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Areas of Expertise</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.expertise || "Not specified"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Research Specialization</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.specialization || "Not specified"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Availability Hours</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.availability || "Not specified"}</span>
              </div>
            </div>
          )}

          {profile.role === "professor" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Research Specialization</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.specialization || "Not specified"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Handled Course Sections</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.subjects || "Not specified"}</span>
              </div>
            </div>
          )}

          {profile.role === "panelist" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Research Specialization</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.specialization || "Not specified"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Panel Assignment Details</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.panelDetails || "Not specified"}</span>
              </div>
            </div>
          )}

          {(profile.role === "admin" || profile.role === "system_admin") && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Position Title</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.position || "N/A"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Access Scope</span>
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
