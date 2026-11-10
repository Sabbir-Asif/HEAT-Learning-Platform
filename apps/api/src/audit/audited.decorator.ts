import { SetMetadata } from "@nestjs/common";
import type { AuditedMetadata } from "./audit.types";

export const AUDITED_KEY = "heat:audited";

export const Audited = (metadata: AuditedMetadata): MethodDecorator =>
  SetMetadata(AUDITED_KEY, metadata);
