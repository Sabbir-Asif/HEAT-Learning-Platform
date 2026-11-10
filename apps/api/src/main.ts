import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { createHttpAdapter } from "./http/http-adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, createHttpAdapter());
  configureApp(app);
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
