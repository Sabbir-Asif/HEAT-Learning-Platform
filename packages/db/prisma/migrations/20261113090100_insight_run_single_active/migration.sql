CREATE UNIQUE INDEX "InsightRun_single_active_key" ON "InsightRun" ((true)) WHERE "status" IN ('PENDING', 'RUNNING');
