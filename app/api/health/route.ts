import { timingSafeEqual } from "crypto";
import { searchDecisions } from "@/lib/bedesten";
import { clientAddress } from "@/lib/auth";
import { getArticleTree, searchLegislation } from "@/lib/mevzuat";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Check = { name: string; ok: boolean; detail: string };

async function run(name: string, probe: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, detail: await probe() };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : "bilinmeyen hata" };
  }
}

/**
 * Bedesten gayriresmî bir uçtur; alan adları veya davranışı habersiz
 * değişebilir. Bu kanarya sözleşmenin hâlâ geçerli olduğunu günlük olarak
 * doğrular, böylece kırılma kullanıcıdan değil buradan öğrenilir.
 */
async function probeDecisionSearch(): Promise<string> {
  const found = await searchDecisions({ phrase: "kira AND tahliye", court: "YARGITAY" });
  if (found.decisions.length === 0) throw new Error("karar araması sonuç döndürmedi");
  const parsed = found.decisions.filter((decision) => decision.esasNo && decision.kararNo && decision.date);
  if (parsed.length === 0) {
    throw new Error("hiçbir kararda esas/karar/tarih ayrıştırılamadı — künye şeması değişmiş olabilir");
  }
  return `${found.decisions.length} karar, ${parsed.length} tam künye`;
}

async function probeLegislationSearch(): Promise<string> {
  const found = await searchLegislation({ name: "Türk Medeni Kanunu", number: "4721", types: ["KANUN"] });
  const law = found.documents.find((document) => document.number === "4721");
  if (!law) throw new Error("4721 sayılı kanun mevzuat aramasında bulunamadı");
  return law.legislationId;
}

async function probeArticleTree(legislationId: string): Promise<string> {
  const articles = await getArticleTree(legislationId);
  if (articles.length < 500) throw new Error(`madde ağacı beklenenden kısa (${articles.length})`);
  if (articles.some((article) => article.articleNo < 1)) {
    throw new Error("madde ağacında numarasız düğüm madde olarak sızdı");
  }
  return `${articles.length} madde`;
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const supplied = request.headers.get("authorization") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(`Bearer ${expected}`);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  }
  // Kanarya Bedesten kotasını tüketir; dışarıdan tetiklenerek kotanın
  // harcanmasını engellemek için sıkı bir sınır uygulanır.
  const limit = await rateLimit(`health:${clientAddress(request)}`, 4, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Sağlık kontrolü sınırı doldu" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const checks: Check[] = [];
  checks.push(await run("bedesten:karar-arama", probeDecisionSearch));

  const legislation = await run("bedesten:mevzuat-arama", probeLegislationSearch);
  checks.push(legislation);
  if (legislation.ok) {
    checks.push(await run("bedesten:madde-agaci", () => probeArticleTree(legislation.detail)));
  }

  const ok = checks.every((check) => check.ok);
  if (!ok) {
    console.error("Bedesten sağlık kontrolü başarısız", JSON.stringify(checks));
  }
  return Response.json(
    { ok, checkedAt: new Date().toISOString(), checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
