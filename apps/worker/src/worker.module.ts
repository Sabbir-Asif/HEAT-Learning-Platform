import { Module } from "@nestjs/common";
import { CoreModule, WorkerMailConnectionCheck } from "api/core";

@Module({ imports: [CoreModule], providers: [WorkerMailConnectionCheck] })
export class WorkerModule {}
