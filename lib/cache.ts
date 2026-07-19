import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";

type CachedDocument = { text: string; mimeType: string };
type CacheRecord = { cachedAt: number; value: CachedDocument };

const directory = process.env.CACHE_DIR ?? path.join(os.tmpdir(), "ictihat-asistani-cache");
const memory = new Map<string, CacheRecord>();
const MAX_MEMORY_ENTRIES = 80;

function cacheKey(namespace: string, documentId: string): string {
  return `${namespace}:${documentId}`;
}

function fileFor(namespace: string, documentId: string): string {
  const key = createHash("sha256").update(cacheKey(namespace, documentId)).digest("hex");
  return path.join(directory, `${key}.json`);
}

function remember(key: string, record: CacheRecord): void {
  memory.delete(key);
  memory.set(key, record);
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value as string | undefined;
    if (oldest) memory.delete(oldest);
  }
}

function valid(record: CacheRecord, maxAgeMs: number): boolean {
  return Date.now() - record.cachedAt <= maxAgeMs && typeof record.value.text === "string" && typeof record.value.mimeType === "string";
}

async function readDocument(namespace: string, documentId: string, maxAgeMs: number): Promise<CachedDocument | null> {
  const key = cacheKey(namespace, documentId);
  const warm = memory.get(key);
  if (warm && valid(warm, maxAgeMs)) return warm.value;

  try {
    const parsed = JSON.parse(await fs.readFile(fileFor(namespace, documentId), "utf8")) as CacheRecord | CachedDocument;
    const record: CacheRecord = "value" in parsed ? parsed : { cachedAt: Date.now(), value: parsed };
    if (!valid(record, maxAgeMs)) return null;
    remember(key, record);
    return record.value;
  } catch {
    return null;
  }
}

async function writeDocument(namespace: string, documentId: string, value: CachedDocument): Promise<void> {
  const record = { cachedAt: Date.now(), value };
  remember(cacheKey(namespace, documentId), record);
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(fileFor(namespace, documentId), JSON.stringify(record), { encoding: "utf8", mode: 0o600 });
  } catch {
    // Salt-okunur veya kalıcı diski olmayan ortamlarda sıcak bellek önbelleği devam eder.
  }
}

export function readDecisionCache(documentId: string): Promise<CachedDocument | null> {
  return readDocument("decision", documentId, 30 * 24 * 60 * 60 * 1000);
}

export function writeDecisionCache(documentId: string, value: CachedDocument): Promise<void> {
  return writeDocument("decision", documentId, value);
}

export function readLegislationCache(legislationId: string): Promise<CachedDocument | null> {
  return readDocument("legislation", legislationId, 24 * 60 * 60 * 1000);
}

export function writeLegislationCache(legislationId: string, value: CachedDocument): Promise<void> {
  return writeDocument("legislation", legislationId, value);
}
