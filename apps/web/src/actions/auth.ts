"use server";

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: {
    email: string;
    role: "student" | "adviser" | "professor" | "panelist" | "admin" | "system_admin" | "dean";
    name: string;
    status: "active" | "pending" | "inactive" | "suspended";
  };
}

const MOCK_USERS: Array<{
  id: string;
  name: string;
  email: string;
  password: string;
  role: "student" | "adviser" | "professor" | "panelist" | "admin" | "system_admin" | "dean";
  status: "active" | "pending" | "inactive" | "suspended";
}> = [
  // Professors / Coordinators
  {
    id: "prof-1",
    name: "Prof. Maria Clara Santos",
    email: "professor01@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-1-alias",
    name: "Prof. Maria Clara Santos",
    email: "prof.santos@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-2",
    name: "Dr. Arthur Pendelton",
    email: "professor02@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-2-alias",
    name: "Dr. Arthur Pendelton",
    email: "prof.pendelton@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-3",
    name: "Dr. Elena Rostova",
    email: "professor03@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-3-alias",
    name: "Dr. Elena Rostova",
    email: "prof.rostova@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-4",
    name: "Prof. Marcus Vance",
    email: "professor04@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-4-alias",
    name: "Prof. Marcus Vance",
    email: "prof.vance@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-5",
    name: "Dr. Sophia Delgado",
    email: "professor05@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },
  {
    id: "prof-5-alias",
    name: "Dr. Sophia Delgado",
    email: "prof.delgado@university.edu.ph",
    password: "password123",
    role: "professor",
    status: "active",
  },

  // Researchers / Students
  {
    id: "student-1",
    name: "Juan Reyes",
    email: "student01@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "student-2",
    name: "Juan Reyes",
    email: "student@advisio.edu.ph",
    password: "Student@12345",
    role: "student",
    status: "active",
  },
  {
    id: "student-3",
    name: "Mateo Alvarez",
    email: "student02@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "student-4",
    name: "Beatrice Cruz",
    email: "student03@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "student-5",
    name: "Gabriel Santos",
    email: "student04@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "student-6",
    name: "Alyssa Dizon",
    email: "student05@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "researcher-1",
    name: "Carlos Mendoza",
    email: "researcher01@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },
  {
    id: "researcher-2",
    name: "Patricia Reyes",
    email: "researcher02@university.edu.ph",
    password: "password123",
    role: "student",
    status: "active",
  },

  // Advisers
  {
    id: "adviser-1",
    name: "Dr. Rachel Lim",
    email: "adviser01@university.edu.ph",
    password: "password123",
    role: "adviser",
    status: "active",
  },
  {
    id: "adviser-2",
    name: "Dr. Rachel Lim",
    email: "adviser@advisio.edu.ph",
    password: "Adviser@12345",
    role: "adviser",
    status: "active",
  },
  {
    id: "adviser-3",
    name: "Dr. Ramon Bautista",
    email: "adviser02@university.edu.ph",
    password: "password123",
    role: "adviser",
    status: "active",
  },
  {
    id: "adviser-4",
    name: "Prof. Teresa Mercado",
    email: "adviser03@university.edu.ph",
    password: "password123",
    role: "adviser",
    status: "active",
  },
  {
    id: "adviser-5",
    name: "Dr. Antonio Villanueva",
    email: "adviser04@university.edu.ph",
    password: "password123",
    role: "adviser",
    status: "active",
  },
  {
    id: "adviser-6",
    name: "Prof. Carmen Salazar",
    email: "adviser05@university.edu.ph",
    password: "password123",
    role: "adviser",
    status: "active",
  },

  // Panelists
  {
    id: "panelist-1",
    name: "Defense Panelist",
    email: "panelist01@university.edu.ph",
    password: "password123",
    role: "panelist",
    status: "active",
  },
  {
    id: "panelist-2",
    name: "Dr. Fernando Gomez",
    email: "panelist02@university.edu.ph",
    password: "password123",
    role: "panelist",
    status: "active",
  },
  {
    id: "panelist-3",
    name: "Prof. Lilian Morales",
    email: "panelist03@university.edu.ph",
    password: "password123",
    role: "panelist",
    status: "active",
  },
  {
    id: "panelist-4",
    name: "Dr. Eduardo Castillo",
    email: "panelist04@university.edu.ph",
    password: "password123",
    role: "panelist",
    status: "active",
  },
  {
    id: "panelist-5",
    name: "Prof. Victoria Navarro",
    email: "panelist05@university.edu.ph",
    password: "password123",
    role: "panelist",
    status: "active",
  },

  // Dean Accounts
  {
    id: "dean-1",
    name: "Dr. Manuel Soriano",
    email: "dean01@university.edu.ph",
    password: "password123",
    role: "dean",
    status: "active",
  },
  {
    id: "dean-2",
    name: "Dr. Angelica Flores",
    email: "dean.cit@university.edu.ph",
    password: "password123",
    role: "dean",
    status: "active",
  },
  {
    id: "dean-3",
    name: "Dr. Ernesto Valerio",
    email: "dean@advisio.edu.ph",
    password: "password123",
    role: "dean",
    status: "active",
  },

  // Admin & System Admin
  {
    id: "admin-1",
    name: "Admin Officer",
    email: "admin01@university.edu.ph",
    password: "password123",
    role: "admin",
    status: "active",
  },
  {
    id: "sysadmin-1",
    name: "System Administrator",
    email: "superadmin01@university.edu.ph",
    password: "password123",
    role: "system_admin",
    status: "active",
  },
  {
    id: "sysadmin-2",
    name: "System Administrator",
    email: "admin@advisio.edu.ph",
    password: "Admin@12345",
    role: "system_admin",
    status: "active",
  },
];

export async function loginAction({
  email,
  password,
}: {
  email: string;
  password?: string;
}): Promise<LoginResult> {
  // Simulate database network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  const trimmedEmail = email?.trim();
  const rawPassword = password;

  if (!trimmedEmail || !rawPassword) {
    return {
      success: false,
      error: "Email and password are required.",
    };
  }

  const user = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase()
  );

  if (!user || user.password !== rawPassword) {
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  // Check account status and return specific error messages
  if (user.status === "pending") {
    return {
      success: false,
      error: "Your account is still pending administrator approval.",
    };
  }

  if (user.status === "inactive") {
    return {
      success: false,
      error: "Please activate your account first.",
    };
  }

  if (user.status === "suspended") {
    return {
      success: false,
      error: "Your account has been suspended. Please contact the system administrator.",
    };
  }

  if (user.status !== "active") {
    return {
      success: false,
      error: "Invalid account status. Please contact the administrator.",
    };
  }

  const validRoles = ["student", "adviser", "professor", "panelist", "admin", "system_admin", "dean"];
  if (!user.role || !validRoles.includes(user.role)) {
    return {
      success: false,
      error: "No dashboard assigned to this account.",
    };
  }

  return {
    success: true,
    user: {
      email: user.email,
      role: user.role as "student" | "adviser" | "professor" | "panelist" | "admin" | "system_admin" | "dean",
      name: user.name,
      status: user.status as "active" | "pending" | "inactive" | "suspended",
    },
  };
}
