"use client";

import React, { useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { Card } from "@/components/ui/Card";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { useRouter, usePathname } from "next/navigation";

export function ProfileEditForm() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { profile, loading, updateProfile } = useProfile();

  // Form states
  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  
  // Role-specific fields
  const [studentId, setStudentId] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [researchInterests, setResearchInterests] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [expertise, setExpertise] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [availability, setAvailability] = useState("");
  const [credentials, setCredentials] = useState("");
  const [subjects, setSubjects] = useState("");
  const [panelDetails, setPanelDetails] = useState("");
  const [position, setPosition] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize form with existing values
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setContactNumber(profile.contactNumber || "");
      setStudentId(profile.studentId || "");
      setProgram(profile.program || "");
      setYearLevel(profile.yearLevel || "");
      setSection(profile.section || "");
      setResearchInterests(profile.researchInterests || "");
      setEmployeeId(profile.employeeId || "");
      setDepartment(profile.department || "");
      setExpertise(profile.expertise || "");
      setSpecialization(profile.specialization || "");
      setAvailability(profile.availability || "");
      setCredentials(profile.credentials || "");
      setSubjects(profile.subjects || "");
      setPanelDetails(profile.panelDetails || "");
      setPosition(profile.position || "");
    }
  }, [profile]);

  // Determine back URL based on role path
  let backUrl = "/student/profile";
  if (pathname.includes("/system-admin")) {
    backUrl = "/system-admin/profile";
  } else if (pathname.includes("/admin")) {
    backUrl = "/admin/profile";
  } else if (pathname.includes("/adviser")) {
    backUrl = "/adviser/profile";
  } else if (pathname.includes("/professor")) {
    backUrl = "/professor/profile";
  } else if (pathname.includes("/panelist")) {
    backUrl = "/panelist/profile";
  }

  const handleCancel = () => {
    router.push(backUrl);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!name.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!contactNumber.trim()) {
      setError("Contact Number is required.");
      return;
    }

    setSaving(true);
    // Simulate a brief save network delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const success = updateProfile({
        name: name.trim(),
        contactNumber: contactNumber.trim(),
        studentId: studentId.trim(),
        program: program.trim(),
        yearLevel: yearLevel.trim(),
        section: section.trim(),
        researchInterests: researchInterests.trim(),
        employeeId: employeeId.trim(),
        department: department.trim(),
        expertise: expertise.trim(),
        specialization: specialization.trim(),
        availability: availability.trim(),
        credentials: credentials.trim(),
        subjects: subjects.trim(),
        panelDetails: panelDetails.trim(),
        position: position.trim(),
      });

      if (success) {
        // Redirect back with success message parameter
        router.push(`${backUrl}?saved=true`);
      } else {
        setError("Failed to update profile. Please try again.");
        setSaving(false);
      }
    } catch {
      setError("An unexpected error occurred while saving.");
      setSaving(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton editing />;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700 flex items-start gap-2.5">
          <i className="ti ti-alert-circle text-[16px] text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6 text-[12.5px] w-full">
        
        {/* Form Body - 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Identity & Contact */}
          <Card className="flex flex-col gap-4 border border-slate-200 shadow-sm h-full">
            <h4 className="font-extrabold text-[#1b4264] text-[13px] border-b border-slate-100 pb-2 flex items-center gap-2">
              <i className="ti ti-user text-[#ffa400] text-[15px]" />
              Personal & Account Info
            </h4>

            {/* Read-Only sensitive area */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[8.5px]">System Email Address</span>
                <span className="font-semibold text-slate-700 break-all">{profile.email}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[8.5px]">Account Role</span>
                <span className="font-semibold text-slate-700 capitalize">{profile.role.replace("_", " ")}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label htmlFor="fullName" className="font-bold text-slate-650">Full Name</label>
              <input
                id="fullName"
                type="text"
                required
                disabled={saving}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                placeholder="e.g. Juan Reyes"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contactNumber" className="font-bold text-slate-655">Contact Number</label>
              <input
                id="contactNumber"
                type="text"
                required
                disabled={saving}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                placeholder="e.g. +63 917 123 4567"
              />
            </div>
          </Card>

          {/* Card 2: Institutional Info */}
          <Card className="flex flex-col gap-4 border border-slate-200 shadow-sm h-full">
            <h4 className="font-extrabold text-[#1b4264] text-[13px] border-b border-slate-100 pb-2 flex items-center gap-2">
              <i className="ti ti-building text-[#ffa400] text-[15px]" />
              Institutional Info
            </h4>

            {profile.role === "student" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="studentId" className="font-bold text-slate-655">Student ID Number</label>
                  <input
                    id="studentId"
                    type="text"
                    disabled={saving}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. 2023-10045"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="program" className="font-bold text-slate-655">Program / Course</label>
                  <input
                    id="program"
                    type="text"
                    disabled={saving}
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. BSCS"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="yearLevel" className="font-bold text-slate-655">Year Level</label>
                    <input
                      id="yearLevel"
                      type="text"
                      disabled={saving}
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                      placeholder="e.g. 3rd Year"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="section" className="font-bold text-slate-655">Section</label>
                    <input
                      id="section"
                      type="text"
                      disabled={saving}
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                      placeholder="e.g. A"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="employeeId" className="font-bold text-slate-655">Faculty Employee ID</label>
                  <input
                    id="employeeId"
                    type="text"
                    disabled={saving}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. EMP-2021-089"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="department" className="font-bold text-slate-655">Department / Office</label>
                  <input
                    id="department"
                    type="text"
                    disabled={saving}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Computer Science Department"
                  />
                </div>
              </>
            )}
          </Card>

          {/* Card 3: Research / Specific Details */}
          <Card className="flex flex-col gap-4 border border-slate-200 shadow-sm h-full">
            <h4 className="font-extrabold text-[#1b4264] text-[13px] border-b border-slate-100 pb-2 flex items-center gap-2">
              <i className="ti ti-award text-[#ffa400] text-[15px]" />
              Specialized Profile Info
            </h4>

            {/* Student details */}
            {profile.role === "student" && (
              <div className="flex flex-col gap-1.5 h-full">
                <label htmlFor="researchInterests" className="font-bold text-slate-655">Research Interests</label>
                <textarea
                  id="researchInterests"
                  disabled={saving}
                  value={researchInterests}
                  onChange={(e) => setResearchInterests(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400] h-40 resize-none"
                  placeholder="e.g. Machine Learning, Natural Language Processing, Computer Vision..."
                />
              </div>
            )}

            {/* Adviser details */}
            {profile.role === "adviser" && (
              <div className="flex flex-col gap-3.5 h-full">
                <div className="flex flex-col gap-1">
                  <label htmlFor="expertise" className="font-bold text-slate-655">Areas of Expertise</label>
                  <input
                    id="expertise"
                    type="text"
                    disabled={saving}
                    value={expertise}
                    onChange={(e) => setExpertise(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Machine Learning, Computer Vision"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="specialization" className="font-bold text-slate-655">Research Specialization</label>
                  <input
                    id="specialization"
                    type="text"
                    disabled={saving}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Deep Learning & AI"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="availability" className="font-bold text-slate-655">Availability Schedule</label>
                  <input
                    id="availability"
                    type="text"
                    disabled={saving}
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Mon/Wed/Fri 10:00 AM - 12:00 PM"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="credentials" className="font-bold text-slate-655">Credentials Summary</label>
                  <input
                    id="credentials"
                    type="text"
                    disabled={saving}
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Ph.D. in Computer Science"
                  />
                </div>
              </div>
            )}

            {/* Professor details */}
            {profile.role === "professor" && (
              <div className="flex flex-col gap-3.5 h-full">
                <div className="flex flex-col gap-1">
                  <label htmlFor="specialization" className="font-bold text-slate-655">Research Specialization</label>
                  <input
                    id="specialization"
                    type="text"
                    disabled={saving}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Big Data Systems"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="subjects" className="font-bold text-slate-655">Handled Subjects / Sections</label>
                  <input
                    id="subjects"
                    type="text"
                    disabled={saving}
                    value={subjects}
                    onChange={(e) => setSubjects(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Capstone 1, Capstone 2"
                  />
                </div>
              </div>
            )}

            {/* Panelist details */}
            {profile.role === "panelist" && (
              <div className="flex flex-col gap-3.5 h-full">
                <div className="flex flex-col gap-1">
                  <label htmlFor="specialization" className="font-bold text-slate-655">Research Specialization</label>
                  <input
                    id="specialization"
                    type="text"
                    disabled={saving}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Cybersecurity, Cryptography"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="panelDetails" className="font-bold text-slate-655">Panel Details</label>
                  <input
                    id="panelDetails"
                    type="text"
                    disabled={saving}
                    value={panelDetails}
                    onChange={(e) => setPanelDetails(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Panel Chair for AI/ML tracks"
                  />
                </div>
              </div>
            )}

            {/* Admin / System Admin details */}
            {(profile.role === "admin" || profile.role === "system_admin") && (
              <div className="flex flex-col gap-3.5 h-full">
                <div className="flex flex-col gap-1">
                  <label htmlFor="position" className="font-bold text-slate-655">Position Title / IT Designation</label>
                  <input
                    id="position"
                    type="text"
                    disabled={saving}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-[#ffa400]"
                    placeholder="e.g. Dean's Administrative Assistant"
                  />
                </div>
              </div>
            )}
          </Card>

        </div>

        {/* Form Action Controls */}
        <div className="border-t border-slate-200 pt-5 flex justify-end gap-3.5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-350 bg-white hover:bg-slate-50 rounded-xl text-slate-700 font-extrabold cursor-pointer transition active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#ffa400] text-[#1b4264] hover:bg-[#e09000] font-extrabold rounded-xl border border-[#ffa400] shadow-sm flex items-center gap-2 cursor-pointer transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#1b4264] border-t-transparent rounded-full animate-spin" />
                <span>Saving Details...</span>
              </>
            ) : (
              <>
                <i className="ti ti-device-floppy text-base" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
