import type { INestApplication, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { AppModule } from "../app.module";
import { configureApp } from "../app.setup";

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/** `HealthController` + `check` becomes `healthCheck`, which orval turns into `useHealthCheck`. */
function operationId(controllerKey: string, methodKey: string): string {
  return `${lowerFirst(controllerKey.replace(/Controller$/, ""))}${upperFirst(methodKey)}`;
}

/** The OpenAPI document of an initialised application. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle("HEAT LMS API").setVersion("1.0.0").build();
  return cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, config, { operationIdFactory: operationId }),
  );
}

/**
 * The OpenAPI document of the real application (or of `rootModule`, for tests). The app is created in preview mode: the module
 * graph is built but no provider is instantiated, so no database, Redis or server is needed.
 */
export async function buildOpenApiDocument(
  rootModule: Type<unknown> = AppModule,
): Promise<OpenAPIObject> {
  const app = await NestFactory.create(rootModule, { logger: false, preview: true });
  try {
    configureApp(app);
    return createOpenApiDocument(app);
  } finally {
    await app.close();
  }
}
