export { AccountProtectionModule } from "./account-protection.module";
export { RegistrationPolicyService } from "./registration-policy.service";
export { VerificationSessionService } from "./verification-session.service";
export type { VerificationSessionWriter } from "./verification-session.service";
export { ResponseTiming } from "./response-timing";
export type { TimingOptions } from "./response-timing";
export {
  ALREADY_REGISTERED_EVENT_TYPE,
  ALREADY_REGISTERED_TEMPLATE_KEY,
  DEFAULT_RESPONSE_FLOOR_MS,
  REGISTRATION_DUPLICATE_AUDIT_ACTION,
  REGISTRATION_REPLACED_AUDIT_ACTION,
} from "./account-protection.constants";
export type {
  AlreadyRegisteredPayload,
  RegistrationOutcome,
  RegistrationPolicyTransaction,
} from "./registration-policy.types";
export { isActiveEmailConflict } from "./active-email-conflict";
