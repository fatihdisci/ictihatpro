import { kvEnabled, kvIncrementWindow } from "./kv";

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function localLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  if (buckets.size > 5000) {
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Sunucusuz ortamda süreç-içi sayaç örnek başına çalıştığı için gerçek sınır
 * "limit × sıcak örnek sayısı" olur. Upstash tanımlıysa sayaç sabit pencereyle
 * paylaşılır; tanımlı değilse veya KV'ye ulaşılamazsa yerel sayaca düşülür
 * (tek süreçli self-host için doğru davranış budur).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!kvEnabled()) return localLimit(key, limit, windowMs);

  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const resetAt = (window + 1) * windowMs;
  const count = await kvIncrementWindow(`rl:${key}:${window}`, Math.ceil(windowMs / 1000) + 5);
  if (count === null) return localLimit(key, limit, windowMs);

  if (count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
