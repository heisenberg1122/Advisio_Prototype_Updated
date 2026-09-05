import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export interface ProfileData {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  contactNumber: string;
  academicYear?: string;
  program?: string;
  college?: string;
  // Student specific:
  studentId?: string;
  yearLevel?: string;
  section?: string;
  researchInterests?: string;
  // Faculty specific (Adviser, Professor, Panelist):
  employeeId?: string;
  department?: string;
  expertise?: string;
  specialization?: string;
  availability?: string;
  credentials?: string;
  subjects?: string;
  panelDetails?: string;
  // Admin specific:
  position?: string;
}

const DEFAULT_PROFILES: Record<string, ProfileData> = {
  student: {
    id: "student-user",
    name: "Student Researcher",
    initials: "SR",
    role: "student",
    email: "",
    contactNumber: "",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
  },
  adviser: {
    id: "adviser-user",
    name: "Faculty Adviser",
    initials: "FA",
    role: "adviser",
    email: "",
    contactNumber: "",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
  },
  professor: {
    id: "prof-user",
    name: "Course Professor",
    initials: "CP",
    role: "professor",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
    email: "",
    contactNumber: "",
  },
  panelist: {
    id: "panelist-user",
    name: "Defense Panelist",
    initials: "DP",
    role: "panelist",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
    email: "",
    contactNumber: "",
  },
  admin: {
    id: "admin-user",
    name: "System Admin",
    initials: "SA",
    role: "admin",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
    email: "",
    contactNumber: "",
  },
  system_admin: {
    id: "sysadmin-user",
    name: "Super Admin",
    initials: "SA",
    role: "system_admin",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "College of Computing",
    email: "",
    contactNumber: "",
  },
};

export const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.split(" ");
  const filteredParts = parts.filter(
    (p) => !/^(dr\.?|prof\.?|dean|mr\.?|ms\.?|mrs\.?)$/i.test(p)
  );
  if (filteredParts.length === 0) return name.substring(0, 2).toUpperCase();
  const initials = filteredParts.map((p) => p[0]).join("").toUpperCase();
  return initials.substring(0, 2);
};

export function useProfile() {
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine active role from pathname
  let role = "student";
  if (pathname.includes("/system-admin")) {
    role = "system_admin";
  } else if (pathname.includes("/admin")) {
    role = "admin";
  } else if (pathname.includes("/adviser")) {
    role = "adviser";
  } else if (pathname.includes("/professor")) {
    role = "professor";
  } else if (pathname.includes("/panelist")) {
    role = "panelist";
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (user) {
        const dynamicInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "SR";
        const dynamicProfile: ProfileData = {
          id: user.id,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
          initials: dynamicInitials,
          role: user.roles?.[0]?.toLowerCase() || role,
          email: user.email,
          contactNumber: "",
          academicYear: "AY 2025–2026",
          college: user.college?.name || user.college?.code || "College of Computing",
          program: user.program?.name || user.program?.code || "BS Information Technology",
          studentId: user.universityId,
          employeeId: user.universityId,
          position: user.roles?.[0] || "User",
        };
        setProfile(dynamicProfile);
        setLoading(false);
        return;
      }

      const key = `advisio_profile_${role}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && !parsed.name?.includes("Juan Reyes") && !parsed.name?.includes("Dr. Rachel Lim") && !parsed.email?.includes("student01@")) {
            setProfile(parsed);
          } else {
            const defaultProf = DEFAULT_PROFILES[role];
            localStorage.setItem(key, JSON.stringify(defaultProf));
            setProfile(defaultProf);
          }
        } catch {
          setProfile(DEFAULT_PROFILES[role]);
        }
      } else {
        const defaultProf = DEFAULT_PROFILES[role];
        localStorage.setItem(key, JSON.stringify(defaultProf));
        setProfile(defaultProf);
      }
      setLoading(false);
    }
  }, [role, user]);

  const updateProfile = (data: Partial<ProfileData>) => {
    if (!profile) return false;
    const updated = {
      ...profile,
      ...data,
      initials: data.name ? getInitials(data.name) : profile.initials,
    };
    
    const key = `advisio_profile_${role}`;
    localStorage.setItem(key, JSON.stringify(updated));
    setProfile(updated);
    
    // Dispatch storage event to notify other components (like sidebar/header UserChip)
    window.dispatchEvent(new Event("profile-updated"));
    return true;
  };

  return {
    profile: profile || DEFAULT_PROFILES[role],
    loading,
    updateProfile,
  };
}
