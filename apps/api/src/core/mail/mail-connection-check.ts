import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap } from "@nestjs/common";
import { APP_CONFIG } from "../config";
import type { AppConfig } from "../config";
import type { MailConfig } from "./mail-config";
import { MAIL_TRANSPORT } from "./mail-transport";
import type { MailTransport } from "./mail-transport";

export interface MailCheckLogger {
  log(line: string): void;
  error(line: string): void;
}

export class MailConnectionCheck implements OnApplicationBootstrap {
  constructor(
    private readonly transport: MailTransport,
    private readonly config: MailConfig,
    private readonly logger: MailCheckLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const target = `host=${this.config.host} port=${this.config.port} tls=${this.config.tls}`;
    const result = await this.transport.verify();
    if (result.ok) {
      this.logger.log(`Mail transport ready ${target}`);
    } else {
      this.logger.error(`Mail transport unreachable ${target} reason=${result.failure}`);
    }
  }
}

@Injectable()
export class WorkerMailConnectionCheck extends MailConnectionCheck {
  constructor(
    @Inject(MAIL_TRANSPORT) transport: MailTransport,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    super(transport, config.mail, new Logger("MailTransport"));
  }
}
