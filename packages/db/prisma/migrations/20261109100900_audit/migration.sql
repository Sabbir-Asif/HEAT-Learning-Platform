CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'heat_app') THEN
    CREATE ROLE "heat_app" NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA "public" TO "heat_app";

REVOKE ALL ON TABLE "AuditLog" FROM PUBLIC;

REVOKE ALL ON TABLE "AuditLog" FROM "heat_app";

GRANT INSERT, SELECT ON TABLE "AuditLog" TO "heat_app";
