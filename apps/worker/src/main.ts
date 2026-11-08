import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  const keepAlive = setInterval(() => {}, 2 ** 30);
  process.once("SIGTERM", () => clearInterval(keepAlive));
  process.once("SIGINT", () => clearInterval(keepAlive));

  new Logger("Worker").log("Worker ready");
}

void bootstrap();
