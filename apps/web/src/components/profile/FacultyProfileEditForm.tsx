"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Save,
  X,
  Plus,
  Trash2,
  GraduationCap,
  Briefcase,
  Award,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Sparkles,
  Info,
} from "lucide-react";
import { useFacultyProfile } from "@/hooks/use-faculty-profile";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import type {
  EducationRecord,
  CertificationRecord,
  ExperienceRecord,
  PublicationRecord,
  AwardRecord,
  FacultyProfileUpdateInput,
} from "@research-management/validations";

const POPULAR_SPECIALTIES = [
  "Web Development",
  "Software Engineering",
  "Artificial Intelligence",
  "Machine Learning",
  "Cybersecurity",
  "Database Management",
  "Networking",
  "Mobile Application Development",
  "Data Analytics",
  "Human-Computer Interaction",
  "Information Systems",
  "Research Methodology",
  "Cloud Computing",
  "Internet of Things",
  "Natural Language Processing",
];

const RESEARCH_TYPE_OPTIONS = [
  "Applied Research",
  "Experimental Research",
  "Developmental Research",
  "Action Research",
  "Qualitative Study",
  "Industry-Sponsored Project",
];

export function FacultyProfileEditForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    profileUser,
    isLoading,
    updateProfile,
    isUpdating,
    getLegacyLocalStorageData,
    dismissLegacyData,
    convertLegacyData,
  } = useFacultyProfile();

  // Basic Details
  const [academicTitle, setAcademicTitle] = useState("");
  const [facultyDesignation, setFacultyDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Summary
  const [biography, setBiography] = useState("");
  const [teachingBackground, setTeachingBackground] = useState("");
  const [mentoringPhilosophy, setMentoringPhilosophy] = useState("");
  const [preferredProjectTypes, setPreferredProjectTypes] = useState("");

  // Specialties & Interests
  const [expertiseKeywords, setExpertiseKeywords] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [researchInterests, setResearchInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [specializedTopics, setSpecializedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [supervisionMethodologies, setSupervisionMethodologies] = useState<string[]>([]);
  const [customMethodology, setCustomMethodology] = useState("");
  const [acceptedResearchTypes, setAcceptedResearchTypes] = useState<string[]>([]);

  // Repeatable Collections
  const [educations, setEducations] = useState<EducationRecord[]>([]);
  const [certifications, setCertifications] = useState<CertificationRecord[]>([]);
  const [experiences, setExperiences] = useState<ExperienceRecord[]>([]);
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);

  // Preferences
  const [advisingPreferences, setAdvisingPreferences] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize from loaded database profile or query params
  useEffect(() => {
    if (profile) {
      setAcademicTitle(profile.academicTitle || "");
      setFacultyDesignation(profile.facultyDesignation || "");
      setDepartment(profile.department || profileUser?.program?.name || "");
      setPhotoUrl(profile.photoUrl || "");
      setBiography(profile.biography || "");
      setTeachingBackground(profile.teachingBackground || "");
      setMentoringPhilosophy(profile.mentoringPhilosophy || "");
      setPreferredProjectTypes(profile.preferredProjectTypes || "");
      setExpertiseKeywords(Array.isArray(profile.expertiseKeywords) ? profile.expertiseKeywords : []);
      setResearchInterests(Array.isArray(profile.researchInterests) ? profile.researchInterests : []);
      setSpecializedTopics(Array.isArray(profile.specializedTopics) ? profile.specializedTopics : []);
      setSupervisionMethodologies(
        Array.isArray(profile.supervisionMethodologies) ? profile.supervisionMethodologies : [],
      );
      setAcceptedResearchTypes(Array.isArray(profile.acceptedResearchTypes) ? profile.acceptedResearchTypes : []);
      setEducations(Array.isArray(profile.educations) ? profile.educations : []);
      setCertifications(Array.isArray(profile.certifications) ? profile.certifications : []);
      setExperiences(Array.isArray(profile.experiences) ? profile.experiences : []);
      setPublications(Array.isArray(profile.publications) ? profile.publications : []);
      setAwards(Array.isArray(profile.awards) ? profile.awards : []);
      setAdvisingPreferences(profile.advisingPreferences || "");
    }
  }, [profile, profileUser]);

  // Check if adviser asked to import legacy data
  useEffect(() => {
    if (searchParams.get("importLegacy") === "true") {
      const legacy = getLegacyLocalStorageData();
      if (legacy) {
        const converted = convertLegacyData(legacy);
        if (converted.department && !department) setDepartment(converted.department);
        if (converted.biography && !biography) setBiography(converted.biography);
        if (converted.expertiseKeywords?.length) {
          setExpertiseKeywords((prev) => Array.from(new Set([...prev, ...(converted.expertiseKeywords || [])])));
        }
        if (converted.specializedTopics?.length) {
          setSpecializedTopics((prev) => Array.from(new Set([...prev, ...(converted.specializedTopics || [])])));
        }
        const importedCertifications = converted.certifications;
        if (importedCertifications?.length) {
          setCertifications((prev) => [...prev, ...importedCertifications]);
        }
        setIsDirty(true);
        dismissLegacyData();
      }
    }
  }, [searchParams, getLegacyLocalStorageData, convertLegacyData, dismissLegacyData, department, biography]);

  // Prevent accidental navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Expertise Tag Helpers
  const toggleSpecialty = (item: string) => {
    markDirty();
    setExpertiseKeywords((prev) => (prev.includes(item) ? prev.filter((k) => k !== item) : [...prev, item]));
  };

  const addCustomSpecialty = () => {
    const trimmed = customSpecialty.trim();
    if (trimmed && !expertiseKeywords.includes(trimmed)) {
      markDirty();
      setExpertiseKeywords((prev) => [...prev, trimmed]);
      setCustomSpecialty("");
    }
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (trimmed && !researchInterests.includes(trimmed)) {
      markDirty();
      setResearchInterests((prev) => [...prev, trimmed]);
      setCustomInterest("");
    }
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !specializedTopics.includes(trimmed)) {
      markDirty();
      setSpecializedTopics((prev) => [...prev, trimmed]);
      setCustomTopic("");
    }
  };

  const toggleResearchType = (type: string) => {
    markDirty();
    setAcceptedResearchTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  // Repeatable Education Helpers
  const addEducation = () => {
    markDirty();
    setEducations((prev) => [
      ...prev,
      {
        id: `edu-${Date.now()}`,
        degreeLevel: "BACHELORS",
        degreeName: "",
        fieldOfStudy: "",
        institution: "",
        graduationYear: new Date().getFullYear(),
      },
    ]);
  };

  const updateEducation = (index: number, field: keyof EducationRecord, value: any) => {
    markDirty();
    setEducations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeEducation = (index: number) => {
    markDirty();
    setEducations((prev) => prev.filter((_, i) => i !== index));
  };

  // Repeatable Experience Helpers
  const addExperience = () => {
    markDirty();
    setExperiences((prev) => [
      ...prev,
      {
        id: `exp-${Date.now()}`,
        type: "TEACHING",
        title: "",
        organization: "",
        startYear: new Date().getFullYear() - 2,
        endYear: null,
        isCurrent: true,
        description: "",
      },
    ]);
  };

  const updateExperience = (index: number, field: keyof ExperienceRecord, value: any) => {
    markDirty();
    setExperiences((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeExperience = (index: number) => {
    markDirty();
    setExperiences((prev) => prev.filter((_, i) => i !== index));
  };

  // Repeatable Certification Helpers
  const addCertification = () => {
    markDirty();
    setCertifications((prev) => [
      ...prev,
      {
        id: `cert-${Date.now()}`,
        title: "",
        issuingBody: "",
        yearIssued: new Date().getFullYear(),
        licenseNumber: "",
      },
    ]);
  };

  const updateCertification = (index: number, field: keyof CertificationRecord, value: any) => {
    markDirty();
    setCertifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeCertification = (index: number) => {
    markDirty();
    setCertifications((prev) => prev.filter((_, i) => i !== index));
  };

  // Repeatable Publication Helpers
  const addPublication = () => {
    markDirty();
    setPublications((prev) => [
      ...prev,
      {
        id: `pub-${Date.now()}`,
        title: "",
        venue: "",
        year: new Date().getFullYear(),
        authors: "",
        url: "",
      },
    ]);
  };

  const updatePublication = (index: number, field: keyof PublicationRecord, value: any) => {
    markDirty();
    setPublications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removePublication = (index: number) => {
    markDirty();
    setPublications((prev) => prev.filter((_, i) => i !== index));
  };

  // Repeatable Award Helpers
  const addAward = () => {
    markDirty();
    setAwards((prev) => [
      ...prev,
      {
        id: `award-${Date.now()}`,
        title: "",
        issuingOrganization: "",
        year: new Date().getFullYear(),
        description: "",
      },
    ]);
  };

  const updateAward = (index: number, field: keyof AwardRecord, value: any) => {
    markDirty();
    setAwards((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeAward = (index: number) => {
    markDirty();
    setAwards((prev) => prev.filter((_, i) => i !== index));
  };

  // Save changes handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate educations if any were added
    for (const edu of educations) {
      if (!edu.degreeName.trim() || !edu.institution.trim()) {
        setError("Please provide the degree name and institution for all educational qualifications.");
        return;
      }
    }

    const payload: FacultyProfileUpdateInput = {
      academicTitle: academicTitle.trim() || null,
      facultyDesignation: facultyDesignation.trim() || null,
      department: department.trim() || null,
      photoUrl: photoUrl.trim() || null,
      biography: biography.trim() || null,
      teachingBackground: teachingBackground.trim() || null,
      mentoringPhilosophy: mentoringPhilosophy.trim() || null,
      preferredProjectTypes: preferredProjectTypes.trim() || null,
      expertiseKeywords,
      researchInterests,
      specializedTopics,
      supervisionMethodologies,
      acceptedResearchTypes,
      advisingPreferences: advisingPreferences.trim() || null,
      educations,
      certifications,
      experiences,
      publications,
      awards,
    };

    try {
      await updateProfile(payload);
      setIsDirty(false);
      router.push("/adviser/profile?saved=true");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile. Please check the fields and try again.");
    }
  };

  if (isLoading) {
    return <ProfileSkeleton editing />;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#17212B] dark:text-white">
            Edit Faculty Professional Profile
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your academic CV credentials, specialties, and mentoring background.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isDirty && !window.confirm("You have unsaved changes. Discard and return to profile?")) {
                return;
              }
              router.push("/adviser/profile");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isUpdating}
            icon={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6 text-xs">
        {/* Section 1: Professional Header & Academic Title */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <GraduationCap className="h-4 w-4 text-[#C9A227]" />
            1. Academic Title & Faculty Designation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Academic Title & Credentials
              </label>
              <input
                type="text"
                value={academicTitle}
                onChange={(e) => {
                  markDirty();
                  setAcademicTitle(e.target.value);
                }}
                placeholder="e.g. Dr., Prof., Ph.D., PE, MSCS"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Displayed beside your name (e.g. Dr. Jane Doe)
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Official Position / Faculty Designation
              </label>
              <input
                type="text"
                value={facultyDesignation}
                onChange={(e) => {
                  markDirty();
                  setFacultyDesignation(e.target.value);
                }}
                placeholder="e.g. Associate Professor, Department Chair, Instructor"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Department / Office</label>
              <input
                type="text"
                value={department}
                onChange={(e) => {
                  markDirty();
                  setDepartment(e.target.value);
                }}
                placeholder="e.g. Department of Information Technology"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Profile Photo URL (Optional)
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => {
                  markDirty();
                  setPhotoUrl(e.target.value);
                }}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Professional Summary & Mentoring Philosophy */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <Lightbulb className="h-4 w-4 text-[#C9A227]" />
            2. Professional Summary & Mentoring Philosophy
          </h3>
          <div className="space-y-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Short Faculty Biography</label>
              <textarea
                rows={3}
                value={biography}
                onChange={(e) => {
                  markDirty();
                  setBiography(e.target.value);
                }}
                placeholder="Introduce your academic background, areas of focus, and experience mentoring researchers."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Teaching Background</label>
              <textarea
                rows={2}
                value={teachingBackground}
                onChange={(e) => {
                  markDirty();
                  setTeachingBackground(e.target.value);
                }}
                placeholder="Courses taught, subject matter experience, or curriculum expertise."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Research Mentoring Philosophy
              </label>
              <textarea
                rows={2}
                value={mentoringPhilosophy}
                onChange={(e) => {
                  markDirty();
                  setMentoringPhilosophy(e.target.value);
                }}
                placeholder="How do you guide students through proposal defense, writing, and empirical methodology?"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Types of Projects Preferred
              </label>
              <input
                type="text"
                value={preferredProjectTypes}
                onChange={(e) => {
                  markDirty();
                  setPreferredProjectTypes(e.target.value);
                }}
                placeholder="e.g. Applied web/mobile systems, IoT sensor networks, machine learning pipelines"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Educational Background (Repeatable) */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#C9A227]" />
              3. Educational Background & Degrees
            </h3>
            <Button variant="outline" size="sm" onClick={addEducation} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Degree
            </Button>
          </div>

          {educations.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No degrees entered yet. Click "Add Degree" to record your Bachelor's, Master's, or Doctoral
              qualifications.
            </p>
          ) : (
            <div className="space-y-4">
              {educations.map((edu, idx) => (
                <div
                  key={edu.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition p-1"
                    title="Remove degree"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pr-8">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Degree Level</label>
                      <select
                        value={edu.degreeLevel}
                        onChange={(e) => updateEducation(idx, "degreeLevel", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      >
                        <option value="BACHELORS">Bachelor's Degree</option>
                        <option value="MASTERS">Master's Degree</option>
                        <option value="DOCTORATE">Doctoral Degree</option>
                        <option value="POST_DOCTORATE">Post-Doctorate</option>
                        <option value="OTHER">Other Qualification</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Degree Title</label>
                      <input
                        type="text"
                        value={edu.degreeName}
                        onChange={(e) => updateEducation(idx, "degreeName", e.target.value)}
                        placeholder="e.g. BS in Information Technology"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Institution / University
                      </label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Graduation Year</label>
                      <input
                        type="number"
                        value={edu.graduationYear || ""}
                        onChange={(e) =>
                          updateEducation(idx, "graduationYear", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="e.g. 2018"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 4: Areas of Expertise */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <Award className="h-4 w-4 text-[#C9A227]" />
            4. Areas of Expertise & Specialty Tags
          </h3>
          <p className="text-slate-500">
            Select standard academic specialties or add your own custom institution-approved disciplines.
          </p>

          <div className="flex flex-wrap gap-2">
            {POPULAR_SPECIALTIES.map((spec) => {
              const isSelected = expertiseKeywords.includes(spec);
              return (
                <button
                  type="button"
                  key={spec}
                  onClick={() => toggleSpecialty(spec)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    isSelected
                      ? "bg-[#0B3A53] text-white border-[#0B3A53] dark:bg-[#C9A227] dark:text-[#101b2b] dark:border-[#C9A227]"
                      : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#0B3A53]"
                  }`}
                >
                  {isSelected ? "✓ " : "+ "}
                  {spec}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={customSpecialty}
              onChange={(e) => setCustomSpecialty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSpecialty();
                }
              }}
              placeholder="Add custom specialty tag..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomSpecialty}>
              Add Tag
            </Button>
          </div>
        </Card>

        {/* Section 5: Research Interests & Supervision */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <Lightbulb className="h-4 w-4 text-[#C9A227]" />
            5. Research Interests & Thesis Topics
          </h3>

          <div className="space-y-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Preferred Research Fields
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {researchInterests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 font-bold"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setResearchInterests((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomInterest();
                    }
                  }}
                  placeholder="e.g. Natural Language Processing, Health Informatics..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomInterest}>
                  Add
                </Button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Specialized Thesis Topics Supervised
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {specializedTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 font-bold"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setSpecializedTopics((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTopic();
                    }
                  }}
                  placeholder="e.g. Weed detection via neural networks, Mobile microfinance security..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomTopic}>
                  Add
                </Button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Accepted Research Types
              </label>
              <div className="flex flex-wrap gap-2">
                {RESEARCH_TYPE_OPTIONS.map((type) => {
                  const isChecked = acceptedResearchTypes.includes(type);
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => toggleResearchType(type)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {isChecked ? "✓ " : ""}
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Section 6: Professional & Academic Experience (Repeatable) */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#C9A227]" />
              6. Professional & Teaching Experience
            </h3>
            <Button variant="outline" size="sm" onClick={addExperience} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Position
            </Button>
          </div>

          {experiences.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No positions added yet. Click "Add Position" to include academic appointments or industry experience.
            </p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp, idx) => (
                <div
                  key={exp.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition p-1"
                    title="Remove experience"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Type</label>
                      <select
                        value={exp.type}
                        onChange={(e) => updateExperience(idx, "type", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      >
                        <option value="TEACHING">Teaching / Academic</option>
                        <option value="INDUSTRY">Industry / Corporate</option>
                        <option value="ADMINISTRATIVE">Institutional Administrative</option>
                        <option value="RESEARCH">Research Fellow / Lab</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Job Title / Position
                      </label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => updateExperience(idx, "title", e.target.value)}
                        placeholder="e.g. Associate Professor"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Organization / Company
                      </label>
                      <input
                        type="text"
                        value={exp.organization}
                        onChange={(e) => updateExperience(idx, "organization", e.target.value)}
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Start Year</label>
                        <input
                          type="text"
                          value={exp.startYear}
                          onChange={(e) => updateExperience(idx, "startYear", e.target.value)}
                          placeholder="e.g. 2018"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">End Year</label>
                        <input
                          type="text"
                          disabled={exp.isCurrent}
                          value={exp.isCurrent ? "Present" : exp.endYear || ""}
                          onChange={(e) => updateExperience(idx, "endYear", e.target.value)}
                          placeholder="e.g. 2022"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={exp.isCurrent}
                          onChange={(e) => updateExperience(idx, "isCurrent", e.target.checked)}
                          className="rounded border-slate-300 text-[#0B3A53]"
                        />
                        Currently active in this role
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 7: Certifications & Licenses (Repeatable) */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
              7. Professional Certifications & Licenses
            </h3>
            <Button variant="outline" size="sm" onClick={addCertification} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Certification
            </Button>
          </div>

          {certifications.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No certifications added yet.</p>
          ) : (
            <div className="space-y-4">
              {certifications.map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition p-1"
                    title="Remove certification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Certification Title
                      </label>
                      <input
                        type="text"
                        value={cert.title}
                        onChange={(e) => updateCertification(idx, "title", e.target.value)}
                        placeholder="e.g. AWS Solutions Architect"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Issuing Body / Organization
                      </label>
                      <input
                        type="text"
                        value={cert.issuingBody}
                        onChange={(e) => updateCertification(idx, "issuingBody", e.target.value)}
                        placeholder="e.g. Amazon Web Services"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Year Issued</label>
                      <input
                        type="number"
                        value={cert.yearIssued || ""}
                        onChange={(e) =>
                          updateCertification(idx, "yearIssued", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="e.g. 2023"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 8: Publications & Contributions (Repeatable) */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#C9A227]" />
              8. Publications & Research Contributions
            </h3>
            <Button variant="outline" size="sm" onClick={addPublication} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Publication
            </Button>
          </div>

          {publications.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No publications added yet.</p>
          ) : (
            <div className="space-y-4">
              {publications.map((pub, idx) => (
                <div
                  key={pub.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => removePublication(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition p-1"
                    title="Remove publication"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Publication Title
                      </label>
                      <input
                        type="text"
                        value={pub.title}
                        onChange={(e) => updatePublication(idx, "title", e.target.value)}
                        placeholder="e.g. Machine Learning in Academic Advising"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Venue / Journal / Conference
                      </label>
                      <input
                        type="text"
                        value={pub.venue}
                        onChange={(e) => updatePublication(idx, "venue", e.target.value)}
                        placeholder="e.g. IEEE Transactions on Education"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Year</label>
                      <input
                        type="text"
                        value={pub.year || ""}
                        onChange={(e) => updatePublication(idx, "year", e.target.value)}
                        placeholder="e.g. 2024"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        URL / DOI Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={pub.url || ""}
                        onChange={(e) => updatePublication(idx, "url", e.target.value)}
                        placeholder="https://doi.org/..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 9: Awards & Achievements (Repeatable) */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2">
              <Award className="h-4 w-4 text-[#C9A227]" />
              9. Awards & Professional Achievements
            </h3>
            <Button variant="outline" size="sm" onClick={addAward} icon={<Plus className="h-3.5 w-3.5" />}>
              Add Award
            </Button>
          </div>

          {awards.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No awards added yet.</p>
          ) : (
            <div className="space-y-4">
              {awards.map((award, idx) => (
                <div
                  key={award.id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeAward(idx)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition p-1"
                    title="Remove award"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-8">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Award Title</label>
                      <input
                        type="text"
                        value={award.title}
                        onChange={(e) => updateAward(idx, "title", e.target.value)}
                        placeholder="e.g. Outstanding Faculty Researcher"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Conferring Organization
                      </label>
                      <input
                        type="text"
                        value={award.issuingOrganization}
                        onChange={(e) => updateAward(idx, "issuingOrganization", e.target.value)}
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Year Received</label>
                      <input
                        type="text"
                        value={award.year || ""}
                        onChange={(e) => updateAward(idx, "year", e.target.value)}
                        placeholder="e.g. 2023"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 10: Advising Preferences */}
        <Card className="p-6 border border-[#DDE3E8] dark:border-white/10 shadow-sm flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-[#C9A227] flex items-center gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
            <CheckCircle2 className="h-4 w-4 text-[#C9A227]" />
            10. Advising Preferences & Group Expectations
          </h3>
          <div>
            <textarea
              rows={3}
              value={advisingPreferences}
              onChange={(e) => {
                markDirty();
                setAdvisingPreferences(e.target.value);
              }}
              placeholder="e.g. Requires weekly progress consultation; groups must submit drafts 48 hours prior to meetings; prefers teams using GitHub for version control."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#101b2b] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
            />
          </div>
        </Card>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => {
              if (isDirty && !window.confirm("You have unsaved changes. Discard and return to profile?")) {
                return;
              }
              router.push("/adviser/profile");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isUpdating} icon={<Save className="h-4 w-4" />}>
            Save Profile Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
