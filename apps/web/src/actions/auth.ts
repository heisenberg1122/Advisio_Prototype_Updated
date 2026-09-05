"use server";

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: {
    email: string;
    role: "student" | "adviser" | "professor" | "panelist" | "admin" | "system_admin";
    name: string;
    status: "active" | "pending" | "inactive" | "suspended";
  };
}

const MOCK_USERS: Array<{
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  status: string;
}> = [];

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

  const validRoles = ["student", "adviser", "professor", "panelist", "admin", "system_admin"];
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
      role: user.role as "student" | "adviser" | "professor" | "panelist" | "admin" | "system_admin",
      name: user.name,
      status: user.status as "active" | "pending" | "inactive" | "suspended",
    },
  };
}
