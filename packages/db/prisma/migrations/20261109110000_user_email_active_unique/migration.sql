CREATE UNIQUE INDEX "User_email_active_key" ON "User" (lower("email")) WHERE "deletedAt" IS NULL;
