import { Inject, Injectable } from "@nestjs/common";
import type { DirectoryOptionListResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import {
  DirectoryCache,
  directoryCacheTtlSeconds,
  directoryEmptyCacheTtlSeconds,
} from "./directory-cache";

const option = { id: true, name: true } as const;

const byName = [{ name: "asc" as const }, { id: "asc" as const }];

const ttlOf = (response: DirectoryOptionListResponse): number =>
  response.items.length > 0 ? directoryCacheTtlSeconds : directoryEmptyCacheTtlSeconds;

@Injectable()
export class DirectoryLookupsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly cache: DirectoryCache,
  ) {}

  universities(): Promise<DirectoryOptionListResponse> {
    return this.cache.remember(
      "universities",
      async () => ({
        items: await this.database.university.findMany({
          where: { archivedAt: null },
          select: option,
          orderBy: byName,
        }),
      }),
      ttlOf,
    );
  }

  faculties(universityId: string): Promise<DirectoryOptionListResponse> {
    return this.cache.remember(
      `faculties:${universityId.toLowerCase()}`,
      async () => ({
        items: await this.database.faculty.findMany({
          where: {
            archivedAt: null,
            universities: { some: { universityId, university: { archivedAt: null } } },
          },
          select: option,
          orderBy: byName,
        }),
      }),
      ttlOf,
    );
  }

  departments(universityId: string, facultyId: string): Promise<DirectoryOptionListResponse> {
    return this.cache.remember(
      `departments:${universityId.toLowerCase()}:${facultyId.toLowerCase()}`,
      async () => ({
        items: await this.database.department.findMany({
          where: {
            universityId,
            facultyId,
            archivedAt: null,
            universityFaculty: { university: { archivedAt: null }, faculty: { archivedAt: null } },
          },
          select: option,
          orderBy: byName,
        }),
      }),
      ttlOf,
    );
  }
}
