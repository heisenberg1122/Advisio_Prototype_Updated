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
  Lightbulb,
  Sparkles,
  Info,
} from "lucide-react";
import { useFacultyProfile } from "@/hooks/use-faculty-profile";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
import "./faculty-profile.css";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Tag } from "@/components/ui/Tag";
import { useAsyncAction } from "@/hooks/use-async-action";
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

const FACULTY_SECTIONS = [
  { id: "title", label: "Title and designation", icon: "ti-id" },
  { id: "summary", label: "Summary", icon: "ti-file-description" },
  { id: "degrees", label: "Degrees", icon: "ti-school" },
  { id: "expertise", label: "Expertise", icon: "ti-bulb" },
  { id: "interests", label: "Research interests", icon: "ti-search" },
  { id: "experience", label: "Experience", icon: "ti-briefcase" },
  { id: "certifications", label: "Certifications", icon: "ti-certificate" },
  { id: "publications", label: "Publications", icon: "ti-book" },
  { id: "awards", label: "Awards", icon: "ti-award" },
  { id: "preferences", label: "Advising preferences", icon: "ti-adjustments" },
] as const;

export function FacultyProfileEditForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    profileUser,
    isLoading,
    updateProfile,
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
  const [supervisionMethodologies, setSupervisionMethodologies] = useState<
    string[]
  >([]);
  const [customMethodology, setCustomMethodology] = useState("");
  const [acceptedResearchTypes, setAcceptedResearchTypes] = useState<string[]>(
    [],
  );

  // Repeatable Collections
  const [educations, setEducations] = useState<EducationRecord[]>([]);
  const [certifications, setCertifications] = useState<CertificationRecord[]>(
    [],
  );
  const [experiences, setExperiences] = useState<ExperienceRecord[]>([]);
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);

  // Preferences
  const [advisingPreferences, setAdvisingPreferences] = useState("");

  const saveAction = useAsyncAction();
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(FACULTY_SECTIONS[0].id);

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
      setExpertiseKeywords(
        Array.isArray(profile.expertiseKeywords)
          ? profile.expertiseKeywords
          : [],
      );
      setResearchInterests(
        Array.isArray(profile.researchInterests)
          ? profile.researchInterests
          : [],
      );
      setSpecializedTopics(
        Array.isArray(profile.specializedTopics)
          ? profile.specializedTopics
          : [],
      );
      setSupervisionMethodologies(
        Array.isArray(profile.supervisionMethodologies)
          ? profile.supervisionMethodologies
          : [],
      );
      setAcceptedResearchTypes(
        Array.isArray(profile.acceptedResearchTypes)
          ? profile.acceptedResearchTypes
          : [],
      );
      setEducations(
        Array.isArray(profile.educations) ? profile.educations : [],
      );
      setCertifications(
        Array.isArray(profile.certifications) ? profile.certifications : [],
      );
      setExperiences(
        Array.isArray(profile.experiences) ? profile.experiences : [],
      );
      setPublications(
        Array.isArray(profile.publications) ? profile.publications : [],
      );
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
        if (converted.department && !department)
          setDepartment(converted.department);
        if (converted.biography && !biography)
          setBiography(converted.biography);
        if (converted.expertiseKeywords?.length) {
          setExpertiseKeywords((prev) =>
            Array.from(
              new Set([...prev, ...(converted.expertiseKeywords || [])]),
            ),
          );
        }
        if (converted.specializedTopics?.length) {
          setSpecializedTopics((prev) =>
            Array.from(
              new Set([...prev, ...(converted.specializedTopics || [])]),
            ),
          );
        }
        const importedCertifications = converted.certifications;
        if (importedCertifications?.length) {
          setCertifications((prev) => [...prev, ...importedCertifications]);
        }
        setIsDirty(true);
        dismissLegacyData();
      }
    }
  }, [
    searchParams,
    getLegacyLocalStorageData,
    convertLegacyData,
    dismissLegacyData,
    department,
    biography,
  ]);

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
    setExpertiseKeywords((prev) =>
      prev.includes(item) ? prev.filter((k) => k !== item) : [...prev, item],
    );
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
    setAcceptedResearchTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
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

  const updateEducation = (
    index: number,
    field: keyof EducationRecord,
    value: any,
  ) => {
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

  const updateExperience = (
    index: number,
    field: keyof ExperienceRecord,
    value: any,
  ) => {
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

  const updateCertification = (
    index: number,
    field: keyof CertificationRecord,
    value: any,
  ) => {
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

  const updatePublication = (
    index: number,
    field: keyof PublicationRecord,
    value: any,
  ) => {
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
  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate educations if any were added
    for (const edu of educations) {
      if (!edu.degreeName.trim() || !edu.institution.trim()) {
        saveAction.warn(
          "Please provide the degree name and institution for all educational qualifications.",
        );
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
      await saveAction.run(
        async () => {
          await updateProfile(payload);
          setIsDirty(false);
          router.push("/adviser/settings?section=faculty&saved=true");
        },
        {
          successMessage: "Faculty profile saved successfully.",
          errorMessage: (error) =>
            error instanceof Error
              ? error.message
              : "Failed to save profile. Please check the fields and try again.",
        },
      );
    } catch {
      // The form remains populated and ready for a safe retry.
    }
  };

  if (isLoading) {
    return <ProfileSkeleton editing />;
  }

  return (
    <div className="phone-page-inset rs faculty-scope w-full max-w-[1200px] mx-auto pb-12">
      <RoleBand
        eyebrow="Faculty profile"
        title="Edit your profile"
        titleId="faculty-edit-title"
        meta="Manage your academic credentials, specialties and mentoring background."
      />

      <ActionFeedback
        id="faculty-profile-save-feedback"
        feedback={saveAction.feedback}
      />

      <div className="faculty-edit">
      <nav className="faculty-nav" aria-label="Profile sections">
        {FACULTY_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={activeSection === section.id}
            onClick={() => {
              setActiveSection(section.id);
              document.getElementById(`faculty-section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <i className={`ti ${section.icon}`} aria-hidden="true" /> {section.label}
          </button>
        ))}
      </nav>
      <form onSubmit={handleSave} className="faculty-form">
        {/* Section 1: Professional Header & Academic Title */}
        <section id="faculty-section-title" className="rh-panel faculty-card">
          <h2 className="faculty-title">Title and designation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                Displayed beside your name (e.g. Dr. Jane Doe)
              </span>
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
                Department / Office
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => {
                  markDirty();
                  setDepartment(e.target.value);
                }}
                placeholder="e.g. Department of Information Technology"
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Professional Summary & Mentoring Philosophy */}
        <section id="faculty-section-summary" className="rh-panel faculty-card">
          <h2 className="faculty-title">Summary</h2>
          <div className="space-y-4">
            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
                Short Faculty Biography
              </label>
              <textarea
                rows={3}
                value={biography}
                onChange={(e) => {
                  markDirty();
                  setBiography(e.target.value);
                }}
                placeholder="Introduce your academic background, areas of focus, and experience mentoring researchers."
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
                Teaching Background
              </label>
              <textarea
                rows={2}
                value={teachingBackground}
                onChange={(e) => {
                  markDirty();
                  setTeachingBackground(e.target.value);
                }}
                placeholder="Courses taught, subject matter experience, or curriculum expertise."
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
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
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Educational Background (Repeatable) */}
        <section id="faculty-section-degrees" className="rh-panel faculty-card">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="faculty-title">Degrees</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addEducation}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Degree
            </Button>
          </div>

          {educations.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No degrees entered yet. Click "Add Degree" to record your
              Bachelor's, Master's, or Doctoral qualifications.
            </p>
          ) : (
            <div className="space-y-4">
              {educations.map((edu, idx) => (
                <div
                  key={edu.id || idx}
                  className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] relative"
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
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Degree Level
                      </label>
                      <select
                        value={edu.degreeLevel}
                        onChange={(e) =>
                          updateEducation(idx, "degreeLevel", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      >
                        <option value="BACHELORS">Bachelor's Degree</option>
                        <option value="MASTERS">Master's Degree</option>
                        <option value="DOCTORATE">Doctoral Degree</option>
                        <option value="POST_DOCTORATE">Post-Doctorate</option>
                        <option value="OTHER">Other Qualification</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Degree Title
                      </label>
                      <input
                        type="text"
                        value={edu.degreeName}
                        onChange={(e) =>
                          updateEducation(idx, "degreeName", e.target.value)
                        }
                        placeholder="e.g. BS in Information Technology"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Institution / University
                      </label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) =>
                          updateEducation(idx, "institution", e.target.value)
                        }
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Graduation Year
                      </label>
                      <input
                        type="number"
                        value={edu.graduationYear || ""}
                        onChange={(e) =>
                          updateEducation(
                            idx,
                            "graduationYear",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        placeholder="e.g. 2018"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Areas of Expertise */}
        <section id="faculty-section-expertise" className="rh-panel faculty-card">
          <h2 className="faculty-title">Expertise</h2>
          <p className="text-slate-500">
            Select standard academic specialties or add your own custom
            institution-approved disciplines.
          </p>

          <div className="flex flex-wrap gap-2">
            {POPULAR_SPECIALTIES.map((spec) => {
              const isSelected = expertiseKeywords.includes(spec);
              return (
                <button
                  type="button"
                  key={spec}
                  onClick={() => toggleSpecialty(spec)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-sm transition cursor-pointer border ${
                    isSelected
                      ? "bg-[var(--color-primary)] text-[var(--college-on-primary)] border-[var(--color-primary)] dark:bg-[#C9A227] dark:text-[#101b2b] dark:border-[#C9A227]"
                      : "bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
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
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSpecialty}
            >
              Add Tag
            </Button>
          </div>
        </section>

        {/* Section 5: Research Interests & Supervision */}
        <section id="faculty-section-interests" className="rh-panel faculty-card">
          <h2 className="faculty-title">Research interests</h2>

          <div className="space-y-4">
            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
                Preferred Research Fields
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {researchInterests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-subtle)] font-bold"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setResearchInterests((prev) =>
                          prev.filter((_, i) => i !== idx),
                        );
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
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomInterest}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1">
                Specialized Thesis Topics Supervised
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {specializedTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-subtle)] font-bold"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => {
                        markDirty();
                        setSpecializedTopics((prev) =>
                          prev.filter((_, i) => i !== idx),
                        );
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
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomTopic}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <label className="font-bold text-[var(--color-text-primary)] block mb-1.5">
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
                      className={`px-3 py-1.5 rounded-xl font-bold text-sm transition border cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
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
        </section>

        {/* Section 6: Professional & Academic Experience (Repeatable) */}
        <section id="faculty-section-experience" className="rh-panel faculty-card">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="faculty-title">Experience</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addExperience}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Position
            </Button>
          </div>

          {experiences.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No positions added yet. Click "Add Position" to include academic
              appointments or industry experience.
            </p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp, idx) => (
                <div
                  key={exp.id || idx}
                  className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] relative space-y-3"
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
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Type
                      </label>
                      <select
                        value={exp.type}
                        onChange={(e) =>
                          updateExperience(idx, "type", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      >
                        <option value="TEACHING">Teaching / Academic</option>
                        <option value="INDUSTRY">Industry / Corporate</option>
                        <option value="ADMINISTRATIVE">
                          Institutional Administrative
                        </option>
                        <option value="RESEARCH">Research Fellow / Lab</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Job Title / Position
                      </label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) =>
                          updateExperience(idx, "title", e.target.value)
                        }
                        placeholder="e.g. Associate Professor"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Organization / Company
                      </label>
                      <input
                        type="text"
                        value={exp.organization}
                        onChange={(e) =>
                          updateExperience(idx, "organization", e.target.value)
                        }
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                          Start Year
                        </label>
                        <input
                          type="text"
                          value={exp.startYear}
                          onChange={(e) =>
                            updateExperience(idx, "startYear", e.target.value)
                          }
                          placeholder="e.g. 2018"
                          className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                          End Year
                        </label>
                        <input
                          type="text"
                          disabled={exp.isCurrent}
                          value={exp.isCurrent ? "Present" : exp.endYear || ""}
                          onChange={(e) =>
                            updateExperience(idx, "endYear", e.target.value)
                          }
                          placeholder="e.g. 2022"
                          className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-[var(--color-text-primary)]">
                        <input
                          type="checkbox"
                          checked={exp.isCurrent}
                          onChange={(e) =>
                            updateExperience(idx, "isCurrent", e.target.checked)
                          }
                          className="rounded border-slate-300 text-[var(--color-text-primary)]"
                        />
                        Currently active in this role
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 7: Certifications & Licenses (Repeatable) */}
        <section id="faculty-section-certifications" className="rh-panel faculty-card">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="faculty-title">Certifications</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addCertification}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Certification
            </Button>
          </div>

          {certifications.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No certifications added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {certifications.map((cert, idx) => (
                <div
                  key={cert.id || idx}
                  className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] relative"
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
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Certification Title
                      </label>
                      <input
                        type="text"
                        value={cert.title}
                        onChange={(e) =>
                          updateCertification(idx, "title", e.target.value)
                        }
                        placeholder="e.g. AWS Solutions Architect"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Issuing Body / Organization
                      </label>
                      <input
                        type="text"
                        value={cert.issuingBody}
                        onChange={(e) =>
                          updateCertification(
                            idx,
                            "issuingBody",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Amazon Web Services"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Year Issued
                      </label>
                      <input
                        type="number"
                        value={cert.yearIssued || ""}
                        onChange={(e) =>
                          updateCertification(
                            idx,
                            "yearIssued",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        placeholder="e.g. 2023"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 8: Publications & Contributions (Repeatable) */}
        <section id="faculty-section-publications" className="rh-panel faculty-card">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="faculty-title">Publications</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addPublication}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Publication
            </Button>
          </div>

          {publications.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No publications added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {publications.map((pub, idx) => (
                <div
                  key={pub.id || idx}
                  className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] relative space-y-3"
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
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Publication Title
                      </label>
                      <input
                        type="text"
                        value={pub.title}
                        onChange={(e) =>
                          updatePublication(idx, "title", e.target.value)
                        }
                        placeholder="e.g. Machine Learning in Academic Advising"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Venue / Journal / Conference
                      </label>
                      <input
                        type="text"
                        value={pub.venue}
                        onChange={(e) =>
                          updatePublication(idx, "venue", e.target.value)
                        }
                        placeholder="e.g. IEEE Transactions on Education"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Year
                      </label>
                      <input
                        type="text"
                        value={pub.year || ""}
                        onChange={(e) =>
                          updatePublication(idx, "year", e.target.value)
                        }
                        placeholder="e.g. 2024"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        URL / DOI Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={pub.url || ""}
                        onChange={(e) =>
                          updatePublication(idx, "url", e.target.value)
                        }
                        placeholder="https://doi.org/..."
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 9: Awards & Achievements (Repeatable) */}
        <section id="faculty-section-awards" className="rh-panel faculty-card">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h2 className="faculty-title">Awards</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addAward}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Award
            </Button>
          </div>

          {awards.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">
              No awards added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {awards.map((award, idx) => (
                <div
                  key={award.id || idx}
                  className="p-4 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] relative"
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
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Award Title
                      </label>
                      <input
                        type="text"
                        value={award.title}
                        onChange={(e) =>
                          updateAward(idx, "title", e.target.value)
                        }
                        placeholder="e.g. Outstanding Faculty Researcher"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Conferring Organization
                      </label>
                      <input
                        type="text"
                        value={award.issuingOrganization}
                        onChange={(e) =>
                          updateAward(
                            idx,
                            "issuingOrganization",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. University of the Assumption"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[var(--color-text-secondary)] block mb-1">
                        Year Received
                      </label>
                      <input
                        type="text"
                        value={award.year || ""}
                        onChange={(e) =>
                          updateAward(idx, "year", e.target.value)
                        }
                        placeholder="e.g. 2023"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 10: Advising Preferences */}
        <section id="faculty-section-preferences" className="rh-panel faculty-card">
          <h2 className="faculty-title">Advising preferences</h2>
          <div>
            <textarea
              rows={3}
              value={advisingPreferences}
              onChange={(e) => {
                markDirty();
                setAdvisingPreferences(e.target.value);
              }}
              placeholder="e.g. Requires weekly progress consultation; groups must submit drafts 48 hours prior to meetings; prefers teams using GitHub for version control."
              className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-white)] dark:bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-hidden focus:ring-2 focus:ring-[#0B3A53]"
            />
          </div>
        </section>

        {/* Bottom Actions */}
        <div className="faculty-save">
          {isDirty && <span className="faculty-save-note">Unsaved changes</span>}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => {
              if (
                isDirty &&
                !window.confirm(
                  "You have unsaved changes. Discard and return to profile?",
                )
              ) {
                return;
              }
              router.push("/adviser/settings?section=faculty");
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            status={saveAction.status}
            loadingText="Saving profile..."
            successText="Profile saved"
            errorText="Try saving again"
            aria-describedby={
              saveAction.feedback ? "faculty-profile-save-feedback" : undefined
            }
            icon={<Save className="h-4 w-4" />}
          >
            Save changes
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
