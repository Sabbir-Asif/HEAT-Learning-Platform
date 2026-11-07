import type { INestApplication, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { AppModule } from "../app.module";
import { configureApp } from "../app.setup";

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

function operationId(controllerKey: string, methodKey: string): string {
  return `${lowerFirst(controllerKey.replace(/Controller$/, ""))}${upperFirst(methodKey)}`;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle("HEAT LMS API").setVersion("1.0.0").build();
  return cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, config, { operationIdFactory: operationId }),
  );
}

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
