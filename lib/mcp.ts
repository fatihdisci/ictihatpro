import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { COURT_TYPES, getDecisionDocument, searchDecisions, verifyDecisionDocument } from "./bedesten";
import { isBedestenRateLimitError } from "./bedesten-http";
import { readDecisionCache, writeDecisionCache } from "./cache";
import { selectEvidence } from "./evidence";
import { getLegislationDocument, LEGISLATION_TYPES, searchLegislation } from "./mevzuat";
import { researchAndAnswer, type ResearchSource } from "./research";
import { issueSourceToken, verifySourceToken } from "./source-token";

const courtSchema = z.enum(["YARGITAY", "DANISTAY", "ISTINAF", "KYB", "HEPSI"]);
const semanticResearchSourceSchema = z.enum(["YARGITAY", "DANISTAY", "ISTINAF", "KYB", "MEVZUAT"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı");

const decisionTokenSchema = z
  .object({
    documentId: z.string(),
    court: z.string().nullable(),
    chamber: z.string().nullable(),
    esasNo: z.string().nullable(),
    kararNo: z.string().nullable(),
    date: z.string().nullable(),
    finalization: z.string().nullable(),
  })
  .strict();

const legislationTokenSchema = z
  .object({
    legislationId: z.string(),
    number: z.string().nullable(),
    name: z.string(),
    type: z.string().nullable(),
    series: z.string().nullable(),
    officialGazetteDate: z.string().nullable(),
    officialGazetteNumber: z.string().nullable(),
    url: z.string().nullable(),
  })
  .strict();

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Bilinmeyen sunucu hatası";
  if (isBedestenRateLimitError(error)) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
      structuredContent: {
        error: "rate_limit_exceeded",
        statusCode: 429,
        retryAfterSeconds: error.retryAfterSeconds,
        message,
      },
    };
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "ictihat-asistani",
      title: "İçtihat ve Mevzuat Asistanı",
      version: "1.3.0",
      websiteUrl: "https://github.com/fatihdisci/ictihatpro",
    },
    {
      instructions: `Bu sunucu Türk hukuku soruları için birincil resmî araştırma kaynağıdır. Kullanıcı Türk hukukunda kanun, madde, yürürlük, Yargıtay, Danıştay, BAM, içtihat, dava türü, hukukî şart veya uygulama sorarsa, kullanıcı araç adını yazmasa bile önce bu sunucunun aracını kullan. Doğal dille anlatılan araştırma sorularında ictihat_semantik_ara kullan; bu araç doğrulanmış kararları ve seçilmişse ilgili resmî mevzuat maddelerini aynı yanıtta ayrı diziler halinde döndürür. Varsayılan kapsam Yargıtay, Danıştay, BAM hukuk, kanun yararına bozma ve resmî mevzuattır; kullanıcının seçtiği kaynak kümesini aynen uygula. Kesin ifade, daire veya tarih filtreli aramalarda ictihat_ara kullan; sonuçlarını ictihat_getir ile tam metinden doğrula. Yalnızca kanun metni veya yürürlük sorularında mevzuat_ara ve ardından mevzuat_getir kullan. sourceToken yalnızca araçlar arası teknik bir belirteçtir; kullanıcıya ASLA gösterme veya açıklama. Arama künyesini, model bilgisini ya da teknik belirteçleri kaynak gibi sunma; yalnızca aracın doğruladığı karar ve mevzuat metinlerini göster. Hukukî yorum, özet veya sonuç üretme istenmemişse doğrudan ilgili maddeyi ve kararı ver. Bu sunucu kapsam dışındaysa bunu açıkça belirt.`,
    }
  );

  server.registerTool(
    "ictihat_semantik_ara",
    {
      title: "Karar ve mevzuat araştır",
      description:
        "Doğal dille anlatılan hukukî mesele için seçilen karar koleksiyonlarını ve resmî mevzuatı birlikte tarar. Kararların tam metnini ve künyesini doğrular, anlam yakınlığıyla seçer ve en yeniden eskiye sıralar. Mevzuatta ilgili maddeleri doğrudan metinden seçer. Hukukî yorum üretmez; doğrulanmış karar künyeleri/pasajları ile ilgili mevzuatı ayrı dizilerde döndürür.",
      inputSchema: {
        soru: z.string().trim().min(5).max(2000).describe("Aranan hukukî meseleyi doğal bir cümleyle anlatın"),
        kaynaklar: z
          .array(semanticResearchSourceSchema)
          .min(1)
          .max(5)
          .default(["YARGITAY", "ISTINAF", "DANISTAY", "KYB", "MEVZUAT"])
          .describe("Taranacak kaynaklar. Karar kaynakları ve MEVZUAT birlikte veya ayrı seçilebilir."),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ soru, kaynaklar }) => {
      try {
        const answer = await researchAndAnswer(
          soru,
          () => undefined,
          undefined,
          kaynaklar as ResearchSource[],
          "sources"
        );
        const decisions = answer.sources
          .filter((source) => source.kind === "decision")
          .map((decision) => {
            const tokenPayload = {
              documentId: decision.documentId,
              court: decision.court,
              chamber: decision.chamber,
              esasNo: decision.esasNo,
              kararNo: decision.kararNo,
              date: decision.date,
              finalization: decision.finalization,
            };
            return {
              ...tokenPayload,
              excerpt: decision.excerpt,
              sourceUrl: decision.sourceUrl,
              sourceToken: issueSourceToken("decision", tokenPayload),
            };
          });
        const legislation = answer.sources
          .filter((source) => source.kind === "legislation")
          .map((source) => {
            const tokenPayload = {
              legislationId: source.legislationId,
              number: source.number,
              name: source.name,
              type: source.type,
              series: source.series,
              officialGazetteDate: source.officialGazetteDate,
              officialGazetteNumber: source.officialGazetteNumber,
              url: source.sourceUrl,
            };
            return {
              ...tokenPayload,
              excerpt: source.excerpt,
              evidenceComplete: source.evidenceComplete,
              sourceToken: issueSourceToken("legislation", tokenPayload),
            };
          });
        return result({
          semantic: true,
          verified: true,
          searchedSources: answer.searchedSources ?? kaynaklar,
          decisions,
          legislation,
          presentation: {
            order: ["legislation", "decisions"],
            rules: [
              "Yalnızca decisions ve legislation dizilerindeki doğrulanmış metinleri kullan.",
              "Kullanıcı istemedikçe hukukî yorum, özet veya sonuç çıkarma; ilgili maddeyi ve kararı doğrudan göster.",
              "sourceToken teknik bir araç belirtecidir; kullanıcıya gösterme veya kaynak olarak yazma.",
            ],
          },
          warning: "Kararlar tam metindeki künye ve anlam ilgisi doğrulandıktan sonra seçilmiş, gösterim için en yeni tarihten eskiye sıralanmıştır. Mevzuat maddeleri resmî metinden seçilmiştir.",
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "ictihat_ara",
    {
      title: "İçtihat ara",
      description:
        "Türk hukukuna ilişkin doğal dildeki her içtihat/karar/dava sorusunda, kullanıcı 'ara' demese bile önce çağır. UYAP Bedesten'de Yargıtay, Danıştay, BAM hukuk ve kanun yararına bozma kararlarını arar. Sonuçlar yalnızca aday künyelerdir; hukukî cevap yazmadan önce seçilen sonuçlar ictihat_getir ile tam metinden doğrulanmalıdır.",
      inputSchema: {
        ifade: z
          .string()
          .trim()
          .min(3)
          .max(500)
          .describe(
            'Karar metninde aranacak hukukî ifade. AND, OR, NOT, parantez ve çift tırnak desteklenir (ör. ipotek AND "türk lirası"); * joker karakteri kullanılamaz. Sonuçlar alaka sırasındadır.'
          ),
        mahkeme: courtSchema.default("HEPSI").describe("Aranacak karar koleksiyonu"),
        daire: z
          .string()
          .trim()
          .min(2)
          .max(200)
          .optional()
          .describe("Tam daire/birim adı veya kısa kod: H1-H23, C1-C23, D1-D17, HGK, CGK, IDDK, VDDK vb."),
        baslangic_tarihi: dateSchema.optional(),
        bitis_tarihi: dateSchema.optional(),
        sayfa: z.number().int().min(1).max(20).default(1),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ ifade, mahkeme, daire, baslangic_tarihi, bitis_tarihi, sayfa }) => {
      try {
        const found = await searchDecisions({
          phrase: ifade,
          court: mahkeme as keyof typeof COURT_TYPES,
          chamber: daire,
          startDate: baslangic_tarihi,
          endDate: bitis_tarihi,
          page: sayfa,
        });
        return result({
          total: found.total,
          page: sayfa,
          warning: "Bunlar arama adaylarıdır. Yalnızca ictihat_getir ile doğrulanmış tam metin cevapta kullanılabilir.",
          decisions: found.decisions.map((decision) => ({
            court: decision.court,
            chamber: decision.chamber,
            esasNo: decision.esasNo,
            kararNo: decision.kararNo,
            date: decision.date,
            finalization: decision.finalization,
            sourceToken: issueSourceToken("decision", decision),
          })),
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "ictihat_getir",
    {
      title: "Doğrulanmış içtihat metnini getir",
      description:
        "ictihat_ara sonucundaki imzalı sourceToken ile kararın tam metnini indirir; arama künyesindeki esas ve karar numaralarını metinde doğrular. Cevapta yalnızca bu aracın verified=true döndürdüğü kararları kullan.",
      inputSchema: {
        sourceToken: z.string().min(20).max(6000).describe("ictihat_ara sonucundan aynen alınan kaynak belirteci"),
        odak: z.string().trim().min(3).max(1000).optional().describe("Uzun metinde ilgili pasajları seçmek için kullanıcının hukukî sorusu"),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ sourceToken, odak }) => {
      try {
        const summary = decisionTokenSchema.parse(verifySourceToken(sourceToken, "decision"));
        let document = await readDecisionCache(summary.documentId);
        if (!document) {
          document = await getDecisionDocument(summary.documentId);
          await writeDecisionCache(summary.documentId, document).catch(() => undefined);
        }
        const verification = verifyDecisionDocument(summary, document.text);
        if (!verification.verified) throw new Error(`Karar doğrulanamadı: ${verification.reason}`);
        const evidence = selectEvidence(document.text, odak ?? "", 60_000);
        return result({
          verified: true,
          metadata: {
            court: summary.court,
            chamber: summary.chamber,
            esasNo: summary.esasNo,
            kararNo: summary.kararNo,
            date: summary.date,
            finalization: summary.finalization,
            bedestenDocumentId: summary.documentId,
          },
          evidenceComplete: evidence.complete,
          text: evidence.text,
          sourceUrl: `https://mevzuat.adalet.gov.tr/ictihat/${summary.documentId}`,
          warning: evidence.complete
            ? "Tam karar metni döndürüldü."
            : "Karar çok uzun olduğu için başı, sonu ve odakla ilişkili pasajları döndürüldü; bu sınırlılığı cevapta belirt.",
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "mevzuat_ara",
    {
      title: "Mevzuat ara",
      description:
        "Türk hukukunda kanun, madde, yönetmelik, yürürlük veya düzenleme sorularında kullanıcı 'ara' demese bile önce çağır. Adalet Bakanlığı Bedesten mevzuat koleksiyonunda kanun, KHK, tüzük, yönetmelik, Cumhurbaşkanlığı düzenlemeleri, tebliğ ve mülga mevzuat arar. Başlık, içerik veya mevzuat numarasından en az birini kullan.",
      inputSchema: {
        baslik: z.string().trim().min(2).max(500).optional().describe("Mevzuat adında/başlığında aranacak ifade"),
        icerik: z.string().trim().min(3).max(500).optional().describe("Mevzuat metninde aranacak ifade"),
        mevzuat_no: z.string().trim().min(1).max(80).optional(),
        turler: z.array(z.enum(LEGISLATION_TYPES)).max(12).optional(),
        resmi_gazete_baslangic: dateSchema.optional(),
        resmi_gazete_bitis: dateSchema.optional(),
        resmi_gazete_sayisi: z.string().trim().min(1).max(40).optional(),
        sayfa: z.number().int().min(1).max(20).default(1),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ baslik, icerik, mevzuat_no, turler, resmi_gazete_baslangic, resmi_gazete_bitis, resmi_gazete_sayisi, sayfa }) => {
      try {
        const found = await searchLegislation({
          name: baslik,
          phrase: icerik,
          number: mevzuat_no,
          types: turler,
          startDate: resmi_gazete_baslangic,
          endDate: resmi_gazete_bitis,
          officialGazetteNumber: resmi_gazete_sayisi,
          page: sayfa,
        });
        return result({
          total: found.total,
          page: sayfa,
          warning: "Güncel metne dayanmak için seçilen sonucu mevzuat_getir ile aç.",
          documents: found.documents.map((document) => ({
            name: document.name,
            number: document.number,
            type: document.type,
            series: document.series,
            officialGazetteDate: document.officialGazetteDate,
            officialGazetteNumber: document.officialGazetteNumber,
            url: document.url,
            sourceToken: issueSourceToken("legislation", document),
          })),
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "mevzuat_getir",
    {
      title: "Mevzuat metnini getir",
      description:
        "mevzuat_ara sonucundaki imzalı sourceToken ile resmî mevzuat metnini getirir. Uzun metinlerde odak sorusuyla ilişkili maddeleri seçer ve kısmi içerik olduğunu bildirir.",
      inputSchema: {
        sourceToken: z.string().min(20).max(6000).describe("mevzuat_ara sonucundan aynen alınan kaynak belirteci"),
        odak: z.string().trim().min(3).max(1000).optional().describe("İlgili maddeleri seçmek için kullanıcının sorusu"),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ sourceToken, odak }) => {
      try {
        const summary = legislationTokenSchema.parse(verifySourceToken(sourceToken, "legislation"));
        const document = await getLegislationDocument(summary.legislationId);
        const evidence = selectEvidence(document.text, odak ?? summary.name, 60_000);
        return result({
          verifiedSource: true,
          metadata: {
            name: summary.name,
            number: summary.number,
            type: summary.type,
            series: summary.series,
            officialGazetteDate: summary.officialGazetteDate,
            officialGazetteNumber: summary.officialGazetteNumber,
            bedestenLegislationId: summary.legislationId,
          },
          evidenceComplete: evidence.complete,
          text: evidence.text,
          sourceUrl: summary.url ?? "https://mevzuat.adalet.gov.tr/",
          warning: evidence.complete
            ? "Tam mevzuat metni döndürüldü."
            : "Mevzuat çok uzun olduğu için başı, sonu ve odakla ilişkili pasajları döndürüldü; yürürlük ve değişiklik geçmişini ayrıca kontrol et.",
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  return server;
}
