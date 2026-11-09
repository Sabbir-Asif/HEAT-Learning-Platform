import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
