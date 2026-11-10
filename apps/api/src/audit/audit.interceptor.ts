import { Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { HeatClient } from "@heat/db";
import { from, lastValueFrom, toArray } from "rxjs";
import type { Observable } from "rxjs";
import { APP_CONFIG, DATABASE } from "../core";
import type { AppConfig } from "../core";
import { AUDITED_KEY } from "./audited.decorator";
import { auditScopeStorage } from "./audit-scope";
import type { AuditScope } from "./audit-scope";
import { AuditService } from "./audit.service";
import type { AuditChange, AuditedMetadata } from "./audit.types";
import { actorOf } from "./request-actor";
import type { AuditableRequest } from "./request-actor";

const sseMetadataKey = "__sse__";

interface ParamsRequest extends AuditableRequest {
  params?: { id?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditedMetadata | undefined>(
      AUDITED_KEY,
      context.getHandler(),
    );
    if (metadata === undefined) return next.handle();
    if (Reflect.getMetadata(sseMetadataKey, context.getHandler()) === true) {
      throw new Error("@Audited handlers cannot be server-sent event streams");
    }
    const request = context.switchToHttp().getRequest<ParamsRequest>();
    const actor = actorOf(request);
    return from(
      this.database.$transaction(
        async (tx) => {
          const scope: AuditScope = { tx, changes: [] };
          const emissions = await auditScopeStorage.run(scope, () =>
            lastValueFrom(next.handle().pipe(toArray())),
          );
          if (emissions.length > 1) {
            throw new Error("@Audited handlers must emit exactly one value");
          }
          const result = emissions[0];
          const changes: AuditChange[] =
            scope.changes.length > 0 ? scope.changes : [{ entityId: request.params?.id ?? null }];
          for (const change of changes) {
            await this.audit.record(tx, actor, { ...metadata, ...change });
          }
          return result;
        },
        {
          maxWait: this.config.audit.transactionMaxWaitMs,
          timeout: this.config.audit.transactionTimeoutMs,
        },
      ),
    );
  }
}
