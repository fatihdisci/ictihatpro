import TurndownService from "turndown";
import { extractText } from "unpdf";
import { plausibleDecisionDate } from "./bedesten";
import { postBedesten } from "./bedesten-http";

const BASE = "https://bedesten.adalet.gov.tr/mevzuat";

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

async function post<T>(path: string, data: Record<string, unknown>, paging = false): Promise<T> {
  return postBedesten({
    base: BASE,
    path,
    payload: { data, applicationName: "UyapMevzuat", ...(paging ? { paging: true } : {}) },
    errorPrefix: "Bedesten mevzuat",
  });
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

function markdown(bytes: Buffer, mimeType: string, label: string): LegislationDocument {
  if (mimeType.includes("html") || mimeType.includes("text")) {
    return { text: turndown.turndown(bytes.toString("utf8")).trim(), mimeType };
  }
  if (mimeType.includes("pdf")) {
    throw new Error(`${label} PDF biçiminde döndü; tam mevzuat metnini kullanın`);
  }
  throw new Error(`Desteklenmeyen ${label} biçimi: ${mimeType}`);
}

export type ArticleNode = {
  articleId: string;
  articleNo: number;
  title: string | null;
  /** Kitap/kısım/bölüm başlıklarından oluşan üst yol. */
  path: string[];
  gerekceId: string | null;
  updatedAt: string | null;
};

type RawNode = {
  maddeId?: unknown;
  maddeNo?: unknown;
  title?: unknown;
  gerekceId?: unknown;
  guncellemeTarihi?: unknown;
  children?: unknown;
};

/**
 * Mevzuatın madde ağacını düz bir madde listesine indirger. Ağaçtaki
 * numarasız düğümler (KİTAP, KISIM, BÖLÜM) madde değil başlıktır; bunlar
 * maddenin `path` alanında üst yol olarak taşınır. Böylece bir maddenin
 * numarası ve kimliği modelin metinden okuduğu değil, resmî servisin verdiği
 * veri olur.
 */
export async function getArticleTree(legislationId: string): Promise<ArticleNode[]> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(legislationId)) throw new Error("Geçersiz mevzuat kimliği");
  const result = await post<{ children?: unknown }>("/mevzuatMaddeTree", { mevzuatId: legislationId });

  const articles: ArticleNode[] = [];
  const walk = (node: RawNode, path: string[]): void => {
    const articleId = value(node.maddeId);
    const title = value(node.title);
    // Başlık düğümlerinde (KİTAP, KISIM, BÖLÜM) maddeNo null gelir. `Number(null)`
    // sıfır ürettiği için tür kontrolü şart: aksi hâlde her başlık "madde 0"
    // olarak listeye girer.
    const rawNo = typeof node.maddeNo === "number" ? node.maddeNo : Number.NaN;
    const articleNo = Number.isInteger(rawNo) && rawNo > 0 ? rawNo : null;
    const children = Array.isArray(node.children) ? (node.children as RawNode[]) : [];

    if (articleId && articleNo !== null) {
      articles.push({
        articleId,
        articleNo,
        title,
        path,
        gerekceId: value(node.gerekceId),
        updatedAt: plausibleDecisionDate(node.guncellemeTarihi),
      });
    }
    const nextPath = articleNo !== null || !title ? path : [...path, title];
    for (const child of children) walk(child, nextPath);
  };

  for (const child of Array.isArray(result.children) ? (result.children as RawNode[]) : []) {
    walk(child, []);
  }
  return articles.sort((a, b) => a.articleNo - b.articleNo);
}

export async function getArticleDocument(articleId: string): Promise<LegislationDocument> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(articleId)) throw new Error("Geçersiz madde kimliği");
  const result = await post<{ content?: string; mimeType?: string }>("/getDocumentContent", {
    documentType: "MADDE",
    id: articleId,
  });
  if (!result.content) throw new Error("Madde içeriği boş");
  return markdown(Buffer.from(result.content, "base64"), result.mimeType ?? "text/html", "madde");
}

export async function getGerekceDocument(gerekceId: string): Promise<LegislationDocument> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(gerekceId)) throw new Error("Geçersiz gerekçe kimliği");
  // Bu uç, diğerlerinden farklı olarak alanı `mimetype` (küçük harfle) döndürür.
  const result = await post<{ content?: string; mimetype?: string; mimeType?: string }>(
    "/getGerekceContent",
    { gerekceId }
  );
  if (!result.content) throw new Error("Gerekçe metni boş");
  return markdown(
    Buffer.from(result.content, "base64"),
    result.mimetype ?? result.mimeType ?? "text/html",
    "gerekçe"
  );
}

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
