CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "University" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Faculty" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UniversityFaculty" (
    "universityId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniversityFaculty_pkey" PRIMARY KEY ("universityId","facultyId")
);

CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "universityId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

CREATE UNIQUE INDEX "Faculty_name_key" ON "Faculty"("name");

CREATE UNIQUE INDEX "Department_universityId_facultyId_name_key" ON "Department"("universityId", "facultyId", "name");

ALTER TABLE "UniversityFaculty" ADD CONSTRAINT "UniversityFaculty_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UniversityFaculty" ADD CONSTRAINT "UniversityFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Department" ADD CONSTRAINT "Department_universityId_facultyId_fkey" FOREIGN KEY ("universityId", "facultyId") REFERENCES "UniversityFaculty"("universityId", "facultyId") ON DELETE RESTRICT ON UPDATE CASCADE;
