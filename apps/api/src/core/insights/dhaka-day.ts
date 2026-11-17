export const dhakaOffsetMs = 6 * 3600 * 1000;
export const nightlyStartHour = 2;

const dayMs = 24 * 3600 * 1000;

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export interface DayWindow {
  start: Date;
  end: Date;
}

export const isDay = (value: string): boolean => {
  if (!dayPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

export const dayOf = (instant: Date): string =>
  new Date(instant.getTime() + dhakaOffsetMs).toISOString().slice(0, 10);

export const dhakaHourOf = (instant: Date): number =>
  new Date(instant.getTime() + dhakaOffsetMs).getUTCHours();

export const dayWindow = (day: string): DayWindow => {
  const start = new Date(Date.parse(`${day}T00:00:00.000Z`) - dhakaOffsetMs);
  return { start, end: new Date(start.getTime() + dayMs) };
};

export const dayAsDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

export const dayFromDate = (value: Date): string => value.toISOString().slice(0, 10);

export const addDays = (day: string, amount: number): string =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + amount * dayMs).toISOString().slice(0, 10);

export const eachDay = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
};

export const isNightlyDue = (now: Date, nightlyAlreadyStartedToday: boolean): boolean =>
  !nightlyAlreadyStartedToday && dhakaHourOf(now) >= nightlyStartHour;

export const recentDays = (now: Date): { from: string; to: string } => {
  const today = dayOf(now);
  return { from: addDays(today, -1), to: today };
};
