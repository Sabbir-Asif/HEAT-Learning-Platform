import { setTimeout as delay } from "node:timers/promises";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";

export interface TimingOptions {
  floorMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

@Injectable()
export class ResponseTiming {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async equalise<T>(work: () => Promise<T>, options: TimingOptions = {}): Promise<T> {
    const floorMs = options.floorMs ?? this.config.accountProtection.responseFloorMs;
    const now = options.now ?? (() => performance.now());
    const sleep = options.sleep ?? ((milliseconds: number) => delay(milliseconds));
    const started = now();
    try {
      return await work();
    } finally {
      const remaining = floorMs - (now() - started);
      if (remaining > 0) await sleep(remaining);
    }
  }
}
