import TurndownService from "turndown";
import { extractText } from "unpdf";
import { resolveChamber } from "./chambers";
import { postBedesten } from "./bedesten-http";

const BASE = "https://bedesten.adalet.gov.tr";
const SEARCH = "/emsal-karar/searchDocuments";
const DOCUMENT = "/emsal-karar/getDocumentContent";

export const COURT_TYPES = {
  YARGITAY: ["YARGITAYKARARI"],
  DANISTAY: ["DANISTAYKARAR"],
  YEREL: ["YERELHUKUK"],
  ISTINAF: ["ISTINAFHUKUK"],
  KYB: ["KYB"],
  HEPSI: ["YARGITAYKARARI", "DANISTAYKARAR", "YERELHUKUK", "ISTINAFHUKUK", "KYB"],
} as const;

export type DecisionCourt = keyof typeof COURT_TYPES | "YARGITAY_ISTINAF";
export type DecisionCollection = (typeof COURT_TYPES)[keyof typeof COURT_TYPES][number];

async function post<T>(path: string, payload: unknown): Promise<T> {
  return postBedesten({ base: BASE, path, payload, errorPrefix: "Bedesten" });
}

function isoDate(value: string, end = false): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Tarih YYYY-AA-GG biçiminde olmalı");
  return `${value}T${end ? "23:59:59" : "00:00:00"}.000Z`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decisionNo(direct: unknown, year: unknown, sequence: unknown): string | null {
  const value = text(direct);
  if (value) return value;
  return year && sequence ? `${year}/${sequence}` : null;
}

export function plausibleDecisionDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  let day: number;
  let month: number;
  let year: number;
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) return null;
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  }
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1900 || year > maxYear || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export type DecisionSummary = {
  documentId: string;
  court: string | null;
  chamber: string | null;
  esasNo: string | null;
  kararNo: string | null;
  date: string | null;
  finalization: string | null;
};

export async function searchDecisions(params: {
  phrase: string;
  court: DecisionCourt;
  courtTypes?: readonly DecisionCollection[];
  chamber?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
}): Promise<{ total: number; decisions: DecisionSummary[] }> {
  // Bedesten "Sadece harf ve rakam" doğrulamasıyla `*` gibi karakterli
  // sorguların tamamını reddeder; AND/OR/NOT, çift tırnak, parantez ve /
  // canlıda kabul edilir. Sıralama alanı gönderilmez: varsayılan sıralama
  // alaka düzenidir, KARAR_TARIHI ise ilgisiz güncel kararları öne alır.
  const phrase = params.phrase
    .replace(/[^\p{L}\p{N}\s"()/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (phrase.length < 3) throw new Error("Arama ifadesi en az 3 karakter olmalı");
  const data: Record<string, unknown> = {
    pageSize: 10,
    pageNumber: Math.min(20, Math.max(1, params.page ?? 1)),
    itemTypeList:
      params.courtTypes?.length
        ? [...params.courtTypes]
        : params.court === "YARGITAY_ISTINAF"
          ? [...COURT_TYPES.YARGITAY, ...COURT_TYPES.ISTINAF]
          : COURT_TYPES[params.court] ?? COURT_TYPES.YARGITAY,
    phrase,
  };
  const chamber = resolveChamber(params.chamber);
  if (chamber) data.birimAdi = chamber;
  if (params.startDate) data.kararTarihiStart = isoDate(params.startDate);
  if (params.endDate) data.kararTarihiEnd = isoDate(params.endDate, true);

  type Raw = {
    emsalKararList?: Array<Record<string, unknown>>;
    total?: number;
  };
  const result = await post<Raw>(SEARCH, {
    data,
    applicationName: "UyapMevzuat",
    paging: true,
  });

  const decisions = (result.emsalKararList ?? [])
    .map((item): DecisionSummary => ({
      documentId: String(item.documentId ?? ""),
      court: text((item.itemType as { description?: unknown } | undefined)?.description),
      chamber: text(item.birimAdi),
      esasNo: decisionNo(item.esasNo, item.esasNoYil, item.esasNoSira),
      kararNo: decisionNo(item.kararNo, item.kararNoYil, item.kararNoSira),
      date: plausibleDecisionDate(item.kararTarihiStr) ?? plausibleDecisionDate(item.kararTarihi),
      finalization: text(item.kesinlesmeDurumu),
    }))
    .filter((item) => item.documentId.length > 0);
  return { total: Number(result.total ?? 0), decisions };
}

export type DecisionDocument = {
  text: string;
  mimeType: string;
};

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.remove(["script", "style", "noscript"]);

export async function getDecisionDocument(documentId: string): Promise<DecisionDocument> {
  if (!/^\d{4,20}$/.test(documentId)) throw new Error("Geçersiz documentId");
  const result = await post<{ content?: string; mimeType?: string }>(DOCUMENT, {
    data: { documentId },
    applicationName: "UyapMevzuat",
  });
  if (!result.content) throw new Error("Karar içeriği boş");
  const mimeType = result.mimeType ?? "application/octet-stream";
  const bytes = Buffer.from(result.content, "base64");
  if (mimeType.includes("html")) {
    return { text: turndown.turndown(bytes.toString("utf8")).trim(), mimeType };
  }
  if (mimeType.includes("pdf")) {
    const pdf = await extractText(new Uint8Array(bytes), { mergePages: true });
    const extracted = Array.isArray(pdf.text) ? pdf.text.join("\n\n") : pdf.text;
    if (!extracted?.trim()) throw new Error("PDF karar metni çıkarılamadı");
    return { text: extracted.trim(), mimeType };
  }
  throw new Error(`Desteklenmeyen karar biçimi: ${mimeType}`);
}

function compactNo(value: string): string {
  return value.replace(/\D/g, "");
}

export function verifyDecisionDocument(summary: DecisionSummary, body: string): {
  verified: boolean;
  reason?: string;
} {
  const compactBody = body.replace(/\D/g, "");
  const required = [summary.esasNo, summary.kararNo].filter(Boolean) as string[];
  if (required.length < 2) return { verified: false, reason: "Esas/karar numarası eksik" };
  const missing = required.find((value) => !compactBody.includes(compactNo(value)));
  if (missing) return { verified: false, reason: `${missing} karar metninde doğrulanamadı` };
  if (body.trim().length < 300) return { verified: false, reason: "Karar metni olağandışı kısa" };
  return { verified: true };
}
