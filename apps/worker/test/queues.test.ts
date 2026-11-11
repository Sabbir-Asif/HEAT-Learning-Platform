import { describe, expect, test } from "vitest";
import {
  CERTIFICATE_QUEUE,
  EMAIL_QUEUE,
  PROBE_QUEUE,
  TRANSCODE_QUEUE,
  jobOptionsFor,
} from "../src/queues";

describe("jobOptionsFor", () => {
  test("email keeps its six attempts with a minute of backoff", () => {
    expect(jobOptionsFor(EMAIL_QUEUE).attempts).toBe(6);
    expect(jobOptionsFor(EMAIL_QUEUE).backoff).toEqual({ type: "exponential", delay: 60000 });
  });

  test("transcode has its own options with two attempts and backoff", () => {
    const options = jobOptionsFor(TRANSCODE_QUEUE);
    expect(options).not.toBe(jobOptionsFor(EMAIL_QUEUE));
    expect(options.attempts).toBe(2);
    expect(options.backoff.type).toBe("exponential");
    expect(options.removeOnFail).toBe(false);
  });

  test("probe retries a few times quickly and keeps failures visible", () => {
    const options = jobOptionsFor(PROBE_QUEUE);
    expect(options.attempts).toBe(3);
    expect(options.removeOnFail).toBe(false);
  });

  test("certificate keeps its six attempts", () => {
    expect(jobOptionsFor(CERTIFICATE_QUEUE).attempts).toBe(6);
  });

  test("an unknown queue has no options", () => {
    expect(() => jobOptionsFor("other")).toThrow("No job options");
  });
});
