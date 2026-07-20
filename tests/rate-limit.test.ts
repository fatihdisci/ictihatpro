import { beforeEach, describe, expect, it, vi } from "vitest";
import { kvEnabled, kvIncrementWindow } from "../lib/kv";
import { rateLimit } from "../lib/rate-limit";

vi.mock("../lib/kv", () => ({
  kvEnabled: vi.fn(),
  kvIncrementWindow: vi.fn(),
}));

const enabled = vi.mocked(kvEnabled);
const increment = vi.mocked(kvIncrementWindow);

beforeEach(() => {
  enabled.mockReset();
  increment.mockReset();
});

describe("rateLimit", () => {
  it("KV yokken süreç-içi sayaçla sınırlar", async () => {
    enabled.mockReturnValue(false);
    const key = `local-${Math.random()}`;

    expect((await rateLimit(key, 2, 60_000)).allowed).toBe(true);
    expect((await rateLimit(key, 2, 60_000)).allowed).toBe(true);

    const blocked = await rateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(increment).not.toHaveBeenCalled();
  });

  it("KV varken sayacı paylaşır ve sınır aşılınca reddeder", async () => {
    enabled.mockReturnValue(true);
    increment.mockResolvedValueOnce(3);

    const result = await rateLimit("shared", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment.mock.calls[0][0]).toMatch(/^rl:shared:\d+$/);

    increment.mockResolvedValueOnce(6);
    const blocked = await rateLimit("shared", 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("KV'ye ulaşılamazsa yerel sayaca düşer, isteği düşürmez", async () => {
    enabled.mockReturnValue(true);
    increment.mockResolvedValue(null);

    const result = await rateLimit(`fallback-${Math.random()}`, 1, 60_000);

    expect(result.allowed).toBe(true);
  });
});
