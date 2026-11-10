import { setTimeout as delay } from "node:timers/promises";
import { Injectable } from "@nestjs/common";
import { DEFAULT_RESPONSE_FLOOR_MS } from "./account-protection.constants";

export interface TimingOptions {
  floorMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

@Injectable()
export class ResponseTiming {
  async equalise<T>(work: () => Promise<T>, options: TimingOptions = {}): Promise<T> {
    const floorMs = options.floorMs ?? DEFAULT_RESPONSE_FLOOR_MS;
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
