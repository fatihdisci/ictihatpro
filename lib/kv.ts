/**
 * Vercel'de her lambda örneği kendi belleğine sahiptir; modül düzeyindeki
 * sayaçlar ve önbellekler örnekler arasında paylaşılmaz. Bu yüzden istek
 * sınırları fiilen "sınır × örnek sayısı" hâline gelir ve Bedesten kotası
 * aşılır. Upstash Redis REST tanımlıysa durum burada paylaşılır; tanımlı
 * değilse (self-host, tek süreç, test) süreç-içi belleğe düşülür ve davranış
 * eskisiyle aynı kalır.
 */

const URL_ENV = ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"] as const;
const TOKEN_ENV = ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"] as const;

function firstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function connection(): { url: string; token: string } | null {
  const url = firstEnv(URL_ENV);
  const token = firstEnv(TOKEN_ENV);
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function kvEnabled(): boolean {
  return connection() !== null;
}

type Command = (string | number)[];

/**
 * Upstash REST `/pipeline` ucu komut dizisini alır ve her komut için
 * `{ result }` veya `{ error }` döndürür. Ağ hatası veya yanlış yapılandırma
 * uygulamayı düşürmemeli: null dönerse çağıran taraf yerel yedeğe geçer.
 */
async function pipeline(commands: Command[]): Promise<unknown[] | null> {
  const target = connection();
  if (!target || commands.length === 0) return null;
  try {
    const response = await fetch(`${target.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(body) || body.length !== commands.length) return null;
    if (body.some((item) => item?.error)) return null;
    return body.map((item) => item.result ?? null);
  } catch {
    return null;
  }
}

/**
 * Sabit pencere sayacı: anahtarı artırır ve ilk artışta pencere süresi kadar
 * TTL verir. Dönen değer pencere içindeki toplam istek sayısıdır; KV
 * kullanılamıyorsa null döner.
 */
export async function kvIncrementWindow(key: string, ttlSeconds: number): Promise<number | null> {
  const results = await pipeline([
    ["INCR", key],
    ["EXPIRE", key, Math.max(1, Math.ceil(ttlSeconds)), "NX"],
  ]);
  if (!results) return null;
  const count = Number(results[0]);
  return Number.isFinite(count) ? count : null;
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const results = await pipeline([["GET", key]]);
  const raw = results?.[0];
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);
  // Upstash tek istek gövdesinde ~1 MB sınırına sahiptir; uzun karar
  // metinleri bu sınırı aşabildiği için sessizce atlanır ve yerel önbellek
  // devreye girer.
  if (serialized.length > 900_000) return;
  await pipeline([["SET", key, serialized, "EX", Math.max(1, Math.ceil(ttlSeconds))]]);
}
