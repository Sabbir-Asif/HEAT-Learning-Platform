CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "number" TEXT NOT NULL DEFAULT upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 16)),
    "recipientName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certificate_enrollmentId_key" ON "Certificate"("enrollmentId");

CREATE UNIQUE INDEX "Certificate_number_key" ON "Certificate"("number");

CREATE UNIQUE INDEX "Certificate_fileKey_key" ON "Certificate"("fileKey");

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_number_format_check" CHECK ("number" ~ '^[0-9A-F]{16}$');

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_fileSha256_sha256_check" CHECK ("fileSha256" ~ '^[0-9a-f]{64}$');
