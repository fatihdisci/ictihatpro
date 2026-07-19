const DEFAULT_CAPACITY = 1;
const DEFAULT_REFILL_MS = 3500;
const DEFAULT_MAX_WAIT_MS = 8000;
const MAX_PENALTY_MS = 60_000;

function configuredNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const legacyRefillMs = configuredNumber("BEDESTEN_MIN_GAP_MS", DEFAULT_REFILL_MS);
const CAPACITY = Math.max(1, Math.floor(configuredNumber("BEDESTEN_RATE_CAPACITY", DEFAULT_CAPACITY)));
const REFILL_MS = Math.max(50, configuredNumber("BEDESTEN_RATE_REFILL_S", legacyRefillMs / 1000) * 1000);
const MAX_WAIT_MS = Math.max(0, configuredNumber("BEDESTEN_RATE_MAX_WAIT_S", DEFAULT_MAX_WAIT_MS / 1000) * 1000);

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  AdaletApplicationName: "UyapMevzuat",
  "Content-Type": "application/json; charset=utf-8",
  Origin: "https://mevzuat.adalet.gov.tr",
  Referer: "https://mevzuat.adalet.gov.tr/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
};

export class BedestenRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    const rounded = Math.max(1, Math.ceil(retryAfterSeconds));
    super(`Bedesten istek sınırına ulaşıldı. Yaklaşık ${rounded} saniye sonra yeniden deneyin.`);
    this.name = "BedestenRateLimitError";
    this.retryAfterSeconds = rounded;
  }
}

export function isBedestenRateLimitError(error: unknown): error is BedestenRateLimitError {
  return error instanceof BedestenRateLimitError;
}

let tokens = CAPACITY;
let lastRefillAt = Date.now();
let notBefore = 0;
let stateQueue: Promise<void> = Promise.resolve();
const inFlight = new Map<string, Promise<unknown>>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function inspectBucket(): Promise<number> {
  const previous = stateQueue;
  let release!: () => void;
  stateQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const now = Date.now();
    if (now < notBefore) return notBefore - now;

    tokens = Math.min(CAPACITY, tokens + (now - lastRefillAt) / REFILL_MS);
    lastRefillAt = now;
    if (tokens >= 1) {
      tokens -= 1;
      return 0;
    }
    return Math.max(1, (1 - tokens) * REFILL_MS);
  } finally {
    release();
  }
}

async function acquireToken(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (true) {
    const waitMs = await inspectBucket();
    if (waitMs <= 0) return;
    if (waitMs > deadline - Date.now()) {
      throw new BedestenRateLimitError(waitMs / 1000);
    }
    await wait(waitMs);
  }
}

function retryDelay(response: Response): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(MAX_PENALTY_MS, Math.max(1000, seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(MAX_PENALTY_MS, Math.max(1000, date - Date.now()));
  }
  return 30_000;
}

function penalize(delayMs: number): void {
  const now = Date.now();
  notBefore = Math.max(notBefore, now + delayMs + 500);
  tokens = 0;
  lastRefillAt = now;
}

async function execute<T>(options: {
  base: string;
  path: string;
  payload: unknown;
  errorPrefix: string;
}): Promise<T> {
  await acquireToken();
  const response = await fetch(options.base + options.path, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(options.payload),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (response.status === 429) {
    const delay = retryDelay(response);
    penalize(delay);
    throw new BedestenRateLimitError((delay + 500) / 1000);
  }
  if (!response.ok) throw new Error(`${options.errorPrefix} HTTP ${response.status}`);

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

/**
 * Bedesten'in karar ve mevzuat uçları aynı IP kotasını paylaşır. Ölçülen sınır
 * 30 saniyede 10 istek olduğundan varsayılan akış patlamasız biçimde 3,5
 * saniyede bir istektir. Aynı istekler ayrıca tek ağ çağrısında birleştirilir.
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
