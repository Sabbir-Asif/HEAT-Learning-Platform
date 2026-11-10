import { describe, expect, test } from "vitest";
import { ipBucket } from "../../src/rate-limit/ip-bucket";

describe("ipBucket", () => {
  test("keeps IPv4 addresses as they are", () => {
    expect(ipBucket("203.0.113.7")).toBe("203.0.113.7");
  });

  test("unwraps IPv4-mapped IPv6 addresses", () => {
    expect(ipBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  test("buckets IPv6 addresses by their /64", () => {
    expect(ipBucket("2001:db8:1:2::1")).toBe(ipBucket("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"));
    expect(ipBucket("2001:db8:1:2::1")).not.toBe(ipBucket("2001:db8:1:3::1"));
    expect(ipBucket("2001:DB8:1:2::1")).toBe("2001:db8:1:2::/64");
  });

  test("handles compressed prefixes and a zone id", () => {
    expect(ipBucket("::1")).toBe("0:0:0:0::/64");
    expect(ipBucket("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });
});
