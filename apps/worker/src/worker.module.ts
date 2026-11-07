import { Module } from "@nestjs/common";
import { CoreModule } from "api/core";

@Module({ imports: [CoreModule] })
export class WorkerModule {}
