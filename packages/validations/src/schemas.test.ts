import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, forgotPasswordSchema } from "./auth.js";
import { createResearchSchema, assignMemberSchema } from "./research.js";

describe("Auth Validation Schemas", () => {
  it("should validate a correct login input", () => {
    const valid = { email: "admin@advisio.edu.ph", password: "Password123" };
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email format in login", () => {
    const invalid = { email: "not-an-email", password: "Password123" };
    const result = loginSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject passwords shorter than 6 characters in login", () => {
    const invalid = { email: "user@advisio.edu.ph", password: "123" };
    const result = loginSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should validate a complete user registration input", () => {
    const valid = {
      universityId: "2024-00123",
      email: "juan.reyes@advisio.edu.ph",
      firstName: "Juan",
      lastName: "Reyes",
      password: "StrongPassword123",
    };
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject registration with missing last name or short password", () => {
    const invalid = {
      universityId: "2024-00123",
      email: "juan.reyes@advisio.edu.ph",
      firstName: "Juan",
      lastName: "",
      password: "short",
    };
    const result = registerSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("Research Project Validation Schemas", () => {
  it("should validate research creation with proper UUIDs and title", () => {
    const valid = {
      researchTypeId: "11111111-1111-1111-1111-111111111111",
      programId: "22222222-2222-2222-2222-222222222222",
      collegeId: "33333333-3333-3333-3333-333333333333",
      academicYearId: "44444444-4444-4444-4444-444444444444",
      title: "AI-Powered Crop Disease Detection",
      abstract: "This capstone focuses on convolutional neural networks for early blight detection.",
    };
    const result = createResearchSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject title shorter than 5 characters", () => {
    const invalid = {
      researchTypeId: "11111111-1111-1111-1111-111111111111",
      programId: "22222222-2222-2222-2222-222222222222",
      collegeId: "33333333-3333-3333-3333-333333333333",
      academicYearId: "44444444-4444-4444-4444-444444444444",
      title: "AI",
    };
    const result = createResearchSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should validate member assignment with allowed project roles", () => {
    const valid = {
      researchId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      projectRole: "LEADER",
    };
    const result = assignMemberSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject invalid project roles", () => {
    const invalid = {
      researchId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      projectRole: "CHAIRMAN", // not in the allowed projectRole enum
    };
    const result = assignMemberSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
