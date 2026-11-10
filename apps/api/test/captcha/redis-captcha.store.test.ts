import { describe, expect, test, vi } from "vitest";
import { RedisCaptchaStore } from "../../src/captcha/redis-captcha.store";

describe("RedisCaptchaStore", () => {
  test("save stores the hash with zero tries and a ttl in one transaction", async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const expire = vi.fn().mockReturnValue({ exec });
    const hset = vi.fn().mockReturnValue({ expire });
    const multi = vi.fn().mockReturnValue({ hset });

    await new RedisCaptchaStore({ multi } as never).save("id-1", "hash", 120);

    expect(hset).toHaveBeenCalledWith("captcha:id-1", { hash: "hash", tries: 0 });
    expect(expire).toHaveBeenCalledWith("captcha:id-1", 120);
    expect(exec).toHaveBeenCalled();
  });

  test.each([
    [0, "gone"],
    [1, "passed"],
    [2, "exhausted"],
    [3, "wrong"],
    [99, "gone"],
  ])("attempt maps script result %s to %s", async (code, expected) => {
    const eval_ = vi.fn().mockResolvedValue(code);

    const outcome = await new RedisCaptchaStore({ eval: eval_ } as never).attempt(
      "id-1",
      "hash",
      3,
    );

    expect(outcome).toBe(expected);
    expect(eval_).toHaveBeenCalledWith(expect.any(String), 1, "captcha:id-1", "hash", 3);
  });

  test("remove deletes the challenge", async () => {
    const del = vi.fn().mockResolvedValue(1);

    await new RedisCaptchaStore({ del } as never).remove("id-1");

    expect(del).toHaveBeenCalledWith("captcha:id-1");
  });
});
