import type { HeatClient } from "./client";
import { hashPassword } from "./password";

export const universityName = "University of Dhaka";
export const frontpageTag = { slug: "frontpage", name: "Front page" } as const;
export const minimumPasswordLength = 12;

export const sampleDirectory: Readonly<Record<string, readonly string[]>> = {
  "Faculty of Arts": ["Bangla", "English", "History", "Philosophy", "Linguistics"],
  "Faculty of Science": ["Physics", "Chemistry", "Mathematics", "Statistics", "Computer Science"],
  "Faculty of Social Sciences": [
    "Economics",
    "Political Science",
    "Sociology",
    "Anthropology",
    "Women and Gender Studies",
  ],
  "Faculty of Business Studies": ["Accounting", "Finance", "Management", "Marketing"],
  "Faculty of Law": ["Law"],
  "Faculty of Biological Sciences": ["Zoology", "Botany", "Biochemistry", "Microbiology"],
  "Faculty of Education": ["Institute of Education and Research"],
  "Faculty of Earth and Environmental Sciences": ["Geography", "Geology", "Oceanography"],
};

export interface SeedOptions {
  superAdminEmail: string | undefined;
  superAdminPassword: string | undefined;
  includeSampleDirectory: boolean;
  production: boolean;
}

export interface SeedSummary {
  superAdminCreated: boolean;
  sampleDirectory: boolean;
}

export class SeedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigError";
  }
}

export const seedOptionsFromEnv = (env: NodeJS.ProcessEnv): SeedOptions => ({
  superAdminEmail: env["SUPER_ADMIN_EMAIL"],
  superAdminPassword: env["SUPER_ADMIN_PASSWORD"],
  includeSampleDirectory: env["SEED_SAMPLE_DIRECTORY"]?.trim().toLowerCase() === "true",
  production: env["NODE_ENV"] === "production",
});

const validate = (options: SeedOptions): { email: string; password: string } => {
  if (options.production && options.includeSampleDirectory) {
    throw new SeedConfigError(
      "SEED_SAMPLE_DIRECTORY=true is not allowed when NODE_ENV is production",
    );
  }
  const email = options.superAdminEmail?.trim().toLowerCase() ?? "";
  const password = options.superAdminPassword ?? "";
  if (email === "") {
    throw new SeedConfigError("SUPER_ADMIN_EMAIL is required and must not be empty");
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new SeedConfigError("SUPER_ADMIN_EMAIL must be an email address");
  }
  if (password === "") {
    throw new SeedConfigError("SUPER_ADMIN_PASSWORD is required and must not be empty");
  }
  if (password.length < minimumPasswordLength) {
    throw new SeedConfigError(
      `SUPER_ADMIN_PASSWORD must be at least ${minimumPasswordLength} characters`,
    );
  }
  return { email, password };
};

const seedSuperAdmin = async (
  prisma: HeatClient,
  email: string,
  password: string,
): Promise<boolean> => {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      throw new SeedConfigError(
        "SUPER_ADMIN_EMAIL belongs to an existing user who is not a super admin",
      );
    }
    return false;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "SUPER_ADMIN",
      realm: "ADMIN",
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    },
  });
  return true;
};

const seedUniversity = async (prisma: HeatClient) =>
  prisma.university.upsert({
    where: { name: universityName },
    create: { name: universityName },
    update: {},
  });

const seedSampleDirectory = async (prisma: HeatClient, universityId: string): Promise<void> => {
  for (const [facultyName, departments] of Object.entries(sampleDirectory)) {
    const faculty = await prisma.faculty.upsert({
      where: { name: facultyName },
      create: { name: facultyName },
      update: {},
    });
    await prisma.universityFaculty.upsert({
      where: { universityId_facultyId: { universityId, facultyId: faculty.id } },
      create: { universityId, facultyId: faculty.id },
      update: {},
    });
    for (const name of departments) {
      await prisma.department.upsert({
        where: {
          universityId_facultyId_name: { universityId, facultyId: faculty.id, name },
        },
        create: { name, universityId, facultyId: faculty.id },
        update: {},
      });
    }
  }
};

export const seed = async (prisma: HeatClient, options: SeedOptions): Promise<SeedSummary> => {
  const { email, password } = validate(options);
  const superAdminCreated = await seedSuperAdmin(prisma, email, password);
  const university = await seedUniversity(prisma);
  await prisma.$includingDeleted().tag.upsert({
    where: { slug: frontpageTag.slug },
    create: { ...frontpageTag, isSystem: true },
    update: { isSystem: true, deletedAt: null },
  });
  if (options.includeSampleDirectory) {
    await seedSampleDirectory(prisma, university.id);
  }
  return { superAdminCreated, sampleDirectory: options.includeSampleDirectory };
};
