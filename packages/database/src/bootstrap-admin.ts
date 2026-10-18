import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function validatePassword(password: string) {
  const knownUnsafe = /password|admin|change.?in.?production|advisio/i;
  if (
    password.length < 16 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    knownUnsafe.test(password)
  ) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must be unique, at least 16 characters, and include upper-case, lower-case, numeric, and symbol characters.",
    );
  }
}

async function main() {
  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const universityId = required("BOOTSTRAP_ADMIN_UNIVERSITY_ID");
  const firstName = required("BOOTSTRAP_ADMIN_FIRST_NAME");
  const lastName = required("BOOTSTRAP_ADMIN_LAST_NAME");
  const password = required("BOOTSTRAP_ADMIN_PASSWORD");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  validatePassword(password);

  const role = await prisma.role.findUnique({
    where: { name: "SYSTEM_ADMIN" },
  });
  if (!role)
    throw new Error(
      "SYSTEM_ADMIN reference data is missing. Run the production-safe reference seed first.",
    );

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });
  if (existing) {
    const isAdministrator = existing.roles.some(
      (assignment) => assignment.roleId === role.id,
    );
    if (!isAdministrator)
      throw new Error(
        "The bootstrap email already belongs to a non-administrator account. No privileges were changed.",
      );
    console.log(
      "The production administrator already exists; no changes were made.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      universityId,
      email,
      firstName,
      lastName,
      passwordHash,
      status: "ACTIVE",
      roles: { create: { roleId: role.id } },
    },
  });
  console.log("The production administrator was created successfully.");
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Administrator bootstrap failed.",
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
