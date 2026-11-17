import { dayWindow } from "./dhaka-day";
import type { RollupSource, RollupStore } from "./insight-ports";
import { RollupAccumulator } from "./rollup-model";
import { planDayWrite } from "./rollup-plan";

export interface DayRebuildResult {
  written: number;
  deleted: number;
  unchanged: number;
}

export class DayRebuilder {
  constructor(
    private readonly source: RollupSource,
    private readonly store: RollupStore,
  ) {}

  async rebuild(day: string): Promise<DayRebuildResult> {
    const accumulator = new RollupAccumulator();
    await this.source.readDay(dayWindow(day), (events) => accumulator.addAll(events));
    const existing = await this.store.readDay(day);
    const plan = planDayWrite(existing, accumulator.result());
    if (plan.upserts.length > 0 || plan.deleteKeys.length > 0) {
      await this.store.applyDay(day, plan);
    }
    return {
      written: plan.upserts.length,
      deleted: plan.deleteKeys.length,
      unchanged: plan.unchanged,
    };
  }
}
