CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE');

CREATE TABLE "Quiz" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "passMarkPercent" INTEGER NOT NULL DEFAULT 70,
    "attemptLimit" INTEGER,
    "waitMinutes" INTEGER NOT NULL DEFAULT 10,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Option" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizAttempt" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "passMarkSnapshot" INTEGER NOT NULL,
    "scorePercent" INTEGER,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttemptGrant" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "extraAttempts" INTEGER NOT NULL,
    "reason" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quiz_moduleId_key" ON "Quiz"("moduleId");

CREATE UNIQUE INDEX "Question_quizId_order_key" ON "Question"("quizId", "order");

CREATE UNIQUE INDEX "Option_questionId_order_key" ON "Option"("questionId", "order");

CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

CREATE UNIQUE INDEX "QuizAttempt_enrollmentId_quizId_idempotencyKey_key" ON "QuizAttempt"("enrollmentId", "quizId", "idempotencyKey");

CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

CREATE INDEX "Answer_optionId_idx" ON "Answer"("optionId");

CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

CREATE INDEX "AttemptGrant_enrollmentId_quizId_idx" ON "AttemptGrant"("enrollmentId", "quizId");

CREATE INDEX "AttemptGrant_quizId_idx" ON "AttemptGrant"("quizId");

CREATE INDEX "AttemptGrant_adminId_idx" ON "AttemptGrant"("adminId");

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Answer" ADD CONSTRAINT "Answer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttemptGrant" ADD CONSTRAINT "AttemptGrant_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttemptGrant" ADD CONSTRAINT "AttemptGrant_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttemptGrant" ADD CONSTRAINT "AttemptGrant_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_passMarkPercent_check" CHECK ("passMarkPercent" BETWEEN 0 AND 100);

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_attemptLimit_check" CHECK ("attemptLimit" IS NULL OR "attemptLimit" >= 1);

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_waitMinutes_check" CHECK ("waitMinutes" >= 0);

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_passMarkSnapshot_check" CHECK ("passMarkSnapshot" BETWEEN 0 AND 100);

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_scorePercent_check" CHECK ("scorePercent" IS NULL OR "scorePercent" BETWEEN 0 AND 100);

ALTER TABLE "AttemptGrant" ADD CONSTRAINT "AttemptGrant_extraAttempts_check" CHECK ("extraAttempts" >= 1);
