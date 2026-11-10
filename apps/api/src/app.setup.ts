import type { INestApplication } from "@nestjs/common";
import helmet from "helmet";

const oneYearSeconds = 31_536_000;

export function configureApp(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: oneYearSeconds, includeSubDomains: true },
      referrerPolicy: { policy: "no-referrer" },
      xContentTypeOptions: true,
    }),
  );
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
}
