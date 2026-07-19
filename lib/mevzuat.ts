import TurndownService from "turndown";
import { extractText } from "unpdf";
import { plausibleDecisionDate } from "./bedesten";

const BASE = "https://bedesten.adalet.gov.tr/mevzuat";
const MIN_GAP_MS = Number(process.env.BEDESTEN_MIN_GAP_MS ?? "3500");

export const LEGISLATION_TYPES = [
  "KANUN",
  "KHK",
  "TUZUK",
  "YONETMELIK",
  "CB_KARARNAME",
  "CB_KARAR",
  "CB_YONETMELIK",
  "CB_GENELGE",
  "KKY",
  "UY",
  "TEBLIGLER",
  "MULGA",
] as const;

export type LegislationType = (typeof LEGISLATION_TYPES)[number];

export type LegislationSummary = {
  legislationId: string;
  number: string | null;
  name: string;
  type: string | null;
  series: string | null;
  officialGazetteDate: string | null;
  officialGazetteNumber: string | null;
  url: string | null;
};

export type LegislationDocument = { text: string; mimeType: string };

const HEADERS = {
  Accept: "application/json",
  AdaletApplicationName: "UyapMevzuat",
  "Content-Type": "application/json; charset=utf-8",
  Origin: "https://mevzuat.adalet.gov.tr",
  Referer: "https://mevzuat.adalet.gov.tr/",
};

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  release();
}

async function post<T>(path: string, data: Record<string, unknown>, paging = false): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await throttle();
    const response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ data, applicationName: "UyapMevzuat", ...(paging ? { paging: true } : {}) }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "10");
      await new Promise((resolve) => setTimeout(resolve, Math.min(30, retryAfter) * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`Bedesten mevzuat HTTP ${response.status}`);
    const body = (await response.json()) as {
      data?: T;
      metadata?: { FMTY?: string; FMU?: string; FMTE?: string };
    };
    if (body.metadata?.FMTY && body.metadata.FMTY !== "SUCCESS") {
      throw new Error(body.metadata.FMU ?? body.metadata.FMTE ?? "Bedesten mevzuat işlem hatası");
    }
    if (body.data == null) throw new Error("Bedesten mevzuat boş veri döndürdü");
    return body.data;
  }
  throw new Error("Bedesten mevzuat istek sınırı aşıldı");
}

function value(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result ? result : null;
}

function typeName(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return valueString(record.description) ?? valueString(record.name);
  }
  return null;
}

function valueString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeOfficialUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://mevzuat.adalet.gov.tr/");
    return url.protocol === "https:" && url.hostname.endsWith("adalet.gov.tr") ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(value: string, end = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Tarih YYYY-AA-GG biçiminde olmalı");
  return `${value}T${end ? "23:59:59" : "00:00:00"}.000Z`;
}

export async function searchLegislation(params: {
  phrase?: string;
  name?: string;
  number?: string;
  types?: LegislationType[];
  startDate?: string;
  endDate?: string;
  officialGazetteNumber?: string;
  page?: number;
}): Promise<{ total: number; documents: LegislationSummary[] }> {
  if (![params.phrase, params.name, params.number].some((item) => item?.trim())) {
    throw new Error("İçerik, başlık veya mevzuat numarasından en az biri verilmelidir");
  }
  const data: Record<string, unknown> = {
    pageSize: 10,
    pageNumber: Math.min(20, Math.max(1, params.page ?? 1)),
    sortFields: ["RESMI_GAZETE_TARIHI"],
    sortDirection: "desc",
  };
  if (params.phrase?.trim()) {
    data.phrase = params.phrase.trim();
    data.basliktaAra = false;
  }
  if (params.name?.trim()) data.mevzuatAdi = params.name.trim();
  if (params.number?.trim()) data.mevzuatNo = params.number.trim();
  if (params.types?.length) data.mevzuatTurList = params.types;
  if (params.startDate) data.resmiGazeteTarihiStart = isoDate(params.startDate);
  if (params.endDate) data.resmiGazeteTarihiEnd = isoDate(params.endDate, true);
  if (params.officialGazetteNumber?.trim()) data.resmiGazeteSayisi = params.officialGazetteNumber.trim();

  type Raw = { mevzuatList?: Array<Record<string, unknown>>; total?: number };
  const result = await post<Raw>("/searchDocuments", data, true);
  const documents = (result.mevzuatList ?? [])
    .map((item): LegislationSummary | null => {
      const legislationId = value(item.mevzuatId);
      const name = value(item.mevzuatAdi);
      if (!legislationId || !name) return null;
      return {
        legislationId,
        number: value(item.mevzuatNo),
        name,
        type: typeName(item.mevzuatTur),
        series: value(item.mevzuatTertip),
        officialGazetteDate:
          plausibleDecisionDate(item.resmiGazeteTarihiStr) ?? plausibleDecisionDate(item.resmiGazeteTarihi),
        officialGazetteNumber: value(item.resmiGazeteSayisi),
        url: safeOfficialUrl(item.url),
      };
    })
    .filter((item): item is LegislationSummary => item !== null);
  return { total: Number(result.total ?? 0), documents };
}

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.remove(["script", "style", "noscript"]);

export async function getLegislationDocument(legislationId: string): Promise<LegislationDocument> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(legislationId)) throw new Error("Geçersiz mevzuat kimliği");
  const result = await post<{ content?: string; mimeType?: string }>("/getDocumentContent", {
    documentType: "MEVZUAT",
    id: legislationId,
  });
  if (!result.content) throw new Error("Mevzuat içeriği boş");
  const mimeType = result.mimeType ?? "text/html";
  const bytes = Buffer.from(result.content, "base64");
  if (mimeType.includes("html") || mimeType.includes("text")) {
    return { text: turndown.turndown(bytes.toString("utf8")).trim(), mimeType };
  }
  if (mimeType.includes("pdf")) {
    const pdf = await extractText(new Uint8Array(bytes), { mergePages: true });
    const extracted = Array.isArray(pdf.text) ? pdf.text.join("\n\n") : pdf.text;
    if (!extracted?.trim()) throw new Error("PDF mevzuat metni çıkarılamadı");
    return { text: extracted.trim(), mimeType };
  }
  throw new Error(`Desteklenmeyen mevzuat biçimi: ${mimeType}`);
}
