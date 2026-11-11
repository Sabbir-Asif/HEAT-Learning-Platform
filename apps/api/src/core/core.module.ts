import { Inject, Logger, Module } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { createClient } from "@heat/db";
import type { HeatClient } from "@heat/db";
import { Redis } from "ioredis";
import { CLOCK, systemClock } from "./clock";
import { APP_CONFIG, loadConfig } from "./config";
import type { AppConfig } from "./config";
import { DATABASE, REDIS } from "./tokens";
import { MAIL_TRANSPORT } from "./mail/mail-transport";
import { createSmtpClient, SmtpMailTransport } from "./mail/smtp-mail-transport";
import { SecretBox } from "./secret-box";

@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
    { provide: CLOCK, useValue: systemClock },
    {
      provide: DATABASE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createClient(config.databaseUrl),
    },
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new Redis(config.redisUrl, { lazyConnect: true }),
    },
    {
      provide: SecretBox,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new SecretBox(config.auth.encryptionKey),
    },
    {
      provide: MAIL_TRANSPORT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new SmtpMailTransport(
          createSmtpClient(config.mail),
          config.mail,
          new Logger("MailTransport"),
        ),
    },
  ],
  exports: [APP_CONFIG, CLOCK, DATABASE, REDIS, SecretBox, MAIL_TRANSPORT],
})
export class CoreModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
    await this.database.$disconnect();
  }
}
