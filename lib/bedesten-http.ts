const DEFAULT_MIN_GAP_MS = 1200;
const MAX_GAP_MS = 30_000;

const configuredGapMs = Number(process.env.BEDESTEN_MIN_GAP_MS ?? DEFAULT_MIN_GAP_MS);
const MIN_GAP_MS = Number.isFinite(configuredGapMs) ? Math.max(250, configuredGapMs) : DEFAULT_MIN_GAP_MS;

const DEFAULT_HEADERS = {
  Accept: "application/json",
  AdaletApplicationName: "UyapMevzuat",
  "Content-Type": "application/json; charset=utf-8",
  Origin: "https://mevzuat.adalet.gov.tr",
  Referer: "https://mevzuat.adalet.gov.tr/",
};

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
let adaptiveGapMs = MIN_GAP_MS;
const inFlight = new Map<string, Promise<unknown>>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function schedule(): Promise<void> {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const remaining = lastRequestAt + adaptiveGapMs - Date.now();
  if (remaining > 0) await wait(remaining);
  lastRequestAt = Date.now();
  release();
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(MAX_GAP_MS, Math.max(1000, seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(MAX_GAP_MS, Math.max(1000, date - Date.now()));
  }
  return Math.min(MAX_GAP_MS, 2000 * 2 ** attempt);
}

async function execute<T>(options: {
  base: string;
  path: string;
  payload: unknown;
  errorPrefix: string;
}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await schedule();
    const response = await fetch(options.base + options.path, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(options.payload),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (response.status === 429 && attempt === 0) {
      const delay = retryDelay(response, attempt);
      adaptiveGapMs = Math.min(MAX_GAP_MS, Math.max(adaptiveGapMs * 2, delay));
      await wait(delay + Math.floor(Math.random() * 350));
      continue;
    }
    if (!response.ok) throw new Error(`${options.errorPrefix} HTTP ${response.status}`);

    adaptiveGapMs = Math.max(MIN_GAP_MS, Math.floor(adaptiveGapMs * 0.8));
    const body = (await response.json()) as {
      data?: T;
      metadata?: { FMTY?: string; FMU?: string; FMTE?: string };
    };
    if (body.metadata?.FMTY && body.metadata.FMTY !== "SUCCESS") {
      throw new Error(body.metadata.FMU ?? body.metadata.FMTE ?? `${options.errorPrefix} işlem hatası`);
    }
    if (body.data == null) throw new Error(`${options.errorPrefix} boş veri döndürdü`);
    return body.data;
  }
  throw new Error(`${options.errorPrefix} istek sınırı aşıldı`);
}

/**
 * Bedesten'in karar ve mevzuat uçları aynı origin üzerindedir. Bu istemci iki
 * modülün de aynı hız sınırını ve aynı eşzamanlı-istek tekilleştirmesini
 * paylaşmasını sağlar.
 */
export async function postBedesten<T>(options: {
  base: string;
  path: string;
  payload: unknown;
  errorPrefix: string;
}): Promise<T> {
  const key = `${options.base}${options.path}:${JSON.stringify(options.payload)}`;
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const pending = execute<T>(options).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, pending);
  return pending;
}
