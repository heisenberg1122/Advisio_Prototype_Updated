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
    id: "student-001",
    name: "Juan Reyes",
    initials: "JR",
    role: "student",
    email: "student01@university.edu.ph",
    contactNumber: "+63 917 123 4567",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "BSCS",
    studentId: "2023-10045",
    yearLevel: "3rd Year",
    section: "A",
    researchInterests: "Machine Learning, Natural Language Processing",
  },
  adviser: {
    id: "adviser-001",
    name: "Dr. Rachel Lim",
    initials: "RL",
    role: "adviser",
    email: "adviser01@university.edu.ph",
    contactNumber: "+63 918 234 5678",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "CCS",
    employeeId: "EMP-2021-089",
    department: "Computer Science Department",
    expertise: "Machine Learning, Neural Networks, Computer Vision",
    specialization: "Deep Learning & AI Applications",
    availability: "Mon/Wed/Fri 10:00 AM - 12:00 PM",
    credentials: "Ph.D. in Computer Science, 10+ publications in AI",
  },
  professor: {
    id: "prof-001",
    name: "Prof. Arthur Pendleton",
    initials: "AP",
    role: "professor",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "CCS",
    email: "professor01@university.edu.ph",
    contactNumber: "+63 919 345 6789",
    employeeId: "EMP-2018-042",
    department: "Information Technology Department",
    specialization: "Big Data, Cloud Computing, Distributed Systems",
    subjects: "Capstone 1, Capstone 2",
  },
  panelist: {
    id: "panelist-001",
    name: "Dr. Lisa Wong",
    initials: "LW",
    role: "panelist",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "CCS",
    email: "panelist01@university.edu.ph",
    contactNumber: "+63 920 456 7890",
    employeeId: "EMP-2019-112",
    department: "Computer Science Department",
    specialization: "Cybersecurity, Cryptography, Blockchain",
    panelDetails: "Panel Chair for AI/ML Tracks",
  },
  admin: {
    id: "admin-001",
    name: "Admin User",
    initials: "AU",
    role: "admin",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "CCS",
    email: "admin01@university.edu.ph",
    contactNumber: "+63 921 567 8901",
    employeeId: "EMP-2020-001",
    department: "CCS Dean's Office",
    position: "Dean's Administrative Assistant",
  },
  system_admin: {
    id: "system-admin-001",
    name: "System Super Admin",
    initials: "SA",
    role: "system_admin",
    academicYear: "AY 2025–2026",
    program: "Capstone",
    college: "CCS",
    email: "superadmin01@university.edu.ph",
    contactNumber: "+63 922 678 9012",
    employeeId: "EMP-2015-000",
    department: "Management Information Systems (MIS)",
    position: "Lead IT Infrastructure Administrator",
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
        const dynamicInitials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "AD";
        const dynamicProfile: ProfileData = {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          initials: dynamicInitials,
          role: user.roles?.[0]?.toLowerCase() || role,
          email: user.email,
          contactNumber: "+63 917 000 0000",
          academicYear: "AY 2025–2026",
          college: user.college?.name || user.college?.code || "College of Information Technology",
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
          setProfile(JSON.parse(saved));
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
