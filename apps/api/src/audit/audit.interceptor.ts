import { Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { HeatClient } from "@heat/db";
import { from, lastValueFrom } from "rxjs";
import type { Observable } from "rxjs";
import { DATABASE } from "../core";
import { AUDITED_KEY } from "./audited.decorator";
import { auditScopeStorage } from "./audit-scope";
import type { AuditScope } from "./audit-scope";
import { AuditService } from "./audit.service";
import type { AuditChange, AuditedMetadata } from "./audit.types";
import { actorOf } from "./request-actor";
import type { AuditableRequest } from "./request-actor";

const transactionTimeoutMs = 15_000;

interface ParamsRequest extends AuditableRequest {
  params?: { id?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditedMetadata | undefined>(
      AUDITED_KEY,
      context.getHandler(),
    );
    if (metadata === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<ParamsRequest>();
    const actor = actorOf(request);
    return from(
      this.database.$transaction(
        async (tx) => {
          const scope: AuditScope = { tx, changes: [] };
          const result = await auditScopeStorage.run(scope, () => lastValueFrom(next.handle()));
          const changes: AuditChange[] =
            scope.changes.length > 0 ? scope.changes : [{ entityId: request.params?.id ?? null }];
          for (const change of changes) {
            await this.audit.record(tx, actor, { ...metadata, ...change });
          }
          return result;
        },
        { timeout: transactionTimeoutMs },
      ),
    );
  }
}
