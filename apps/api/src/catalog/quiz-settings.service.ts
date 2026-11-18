import { Inject, Injectable } from "@nestjs/common";
import { quizSettingsKey } from "@heat/contracts";
import type { AdminQuizSettingsResponse, QuizSettingsRequest } from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { readStoredQuizSettings } from "./quiz-settings-rules";

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class QuizSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  async admin(): Promise<AdminQuizSettingsResponse> {
    const row = await this.database.siteSetting.findUnique({
      where: { key: quizSettingsKey },
      select: { value: true, updatedAt: true },
    });
    return {
      ...readStoredQuizSettings(row?.value),
      updatedAt: row === null ? null : row.updatedAt.toISOString(),
    };
  }

  async update(request: QuizSettingsRequest): Promise<AdminQuizSettingsResponse> {
    const client = this.audit.client(this.database);
    const current = await client.siteSetting.findUnique({
      where: { key: quizSettingsKey },
      select: { value: true },
    });
    const saved = await client.siteSetting.upsert({
      where: { key: quizSettingsKey },
      create: { key: quizSettingsKey, value: asJson(request) },
      update: { value: asJson(request) },
      select: { id: true, updatedAt: true },
    });
    this.audit.capture({
      entityId: saved.id,
      before: readStoredQuizSettings(current?.value),
      after: request,
    });
    return { ...request, updatedAt: saved.updatedAt.toISOString() };
  }
}
