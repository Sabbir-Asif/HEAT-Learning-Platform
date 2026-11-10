import { Inject, Module } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import type { Redis } from "ioredis";
import { AuditModule } from "../audit";
import { APP_CONFIG, CoreModule } from "../core";
import type { AppConfig } from "../core";
import { RateLimitModule } from "../rate-limit";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";
import { DirectoryCache } from "./directory-cache";
import { DIRECTORY_CACHE_REDIS, createDirectoryCacheRedis } from "./directory-cache.redis";
import { DirectoryLookupsController } from "./directory-lookups.controller";
import { DirectoryLookupsService } from "./directory-lookups.service";
import { FacultiesController } from "./faculties.controller";
import { FacultiesService } from "./faculties.service";
import { UniversitiesController } from "./universities.controller";
import { UniversitiesService } from "./universities.service";

@Module({
  imports: [CoreModule, AuditModule, RateLimitModule],
  controllers: [
    UniversitiesController,
    FacultiesController,
    DepartmentsController,
    DirectoryLookupsController,
  ],
  providers: [
    UniversitiesService,
    FacultiesService,
    DepartmentsService,
    DirectoryLookupsService,
    DirectoryCache,
    {
      provide: DIRECTORY_CACHE_REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDirectoryCacheRedis(config.redisUrl),
    },
  ],
  exports: [UniversitiesService, FacultiesService, DepartmentsService, DirectoryCache],
})
export class DirectoryModule implements OnApplicationShutdown {
  constructor(@Inject(DIRECTORY_CACHE_REDIS) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
