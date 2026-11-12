const runHourDhaka = 2;
const dhakaOffsetHours = 6;
const dayMs = 24 * 60 * 60 * 1000;

export const nextExpiryRunAt = (now: Date): Date => {
  const utcHour = (runHourDhaka - dhakaOffsetHours + 24) % 24;
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour),
  );
  return candidate.getTime() > now.getTime() ? candidate : new Date(candidate.getTime() + dayMs);
};
