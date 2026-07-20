import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bedestenBooleanQuery, decisionMatchesQuestion, researchAndAnswer } from "../lib/research";
import { legislationSolrQuery, relevantLegislationArticles } from "../lib/legal-search";
import { complete } from "../lib/deepseek";
import { getDecisionDocument, searchDecisions, verifyDecisionDocument } from "../lib/bedesten";
import {
  readDecisionCache,
  readLegislationCache,
  writeDecisionCache,
  writeLegislationCache,
} from "../lib/cache";
import { getLegislationDocument, searchLegislation } from "../lib/mevzuat";
import { semanticRerank } from "../lib/semantic";

vi.mock("../lib/deepseek", () => ({ complete: vi.fn() }));
vi.mock("../lib/bedesten", () => ({
  searchDecisions: vi.fn(),
  getDecisionDocument: vi.fn(),
  verifyDecisionDocument: vi.fn(),
}));
vi.mock("../lib/cache", () => ({
  readDecisionCache: vi.fn(),
  writeDecisionCache: vi.fn(),
  readLegislationCache: vi.fn(),
  writeLegislationCache: vi.fn(),
}));
vi.mock("../lib/mevzuat", () => ({
  LEGISLATION_TYPES: [
    "KANUN", "KHK", "TUZUK", "YONETMELIK", "CB_KARARNAME", "CB_KARAR",
    "CB_YONETMELIK", "CB_GENELGE", "KKY", "UY", "TEBLIGLER", "MULGA",
  ],
  searchLegislation: vi.fn(),
  getLegislationDocument: vi.fn(),
}));
vi.mock("../lib/semantic", async (importOriginal) => ({
  // DEFAULT_MIN_SCORE gerçek değerleriyle kalmalı: sahte bir eşik, eleme
  // davranışını testlerde sessizce değiştirir.
  ...(await importOriginal<typeof import("../lib/semantic")>()),
  semanticRerank: vi.fn(),
}));

function decisionSummary(documentId: string, overrides: Record<string, unknown> = {}) {
  return {
    documentId,
    court: "Yargıtay Kararı",
    chamber: "2. Hukuk Dairesi",
    esasNo: "2023/1234",
    kararNo: "2024/5678",
    date: "12.03.2024",
    finalization: null,
    ...overrides,
  };
}

function toolCallMessage(name: string, args: Record<string, unknown>, id = name) {
  return {
    role: "assistant" as const,
    tool_calls: [{ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } }],
  };
}

const personnel = {
  legislationId: "personel",
  number: "42366",
  name: "Tarım ve Kırsal Kalkınmayı Destekleme Kurumu Personel Yönetmeliği",
  type: "Yönetmelik",
  series: null,
  officialGazetteDate: "01.01.2024",
  officialGazetteNumber: null,
  url: null,
};

const civilCode = {
  legislationId: "tmk",
  number: "4721",
  name: "Türk Medeni Kanunu",
  type: "Kanun",
  series: "5",
  officialGazetteDate: "08.12.2001",
  officialGazetteNumber: "24607",
  url: null,
};

const civilCodeText = `MADDE 166
Evlilik birliği temelinden sarsılmış olursa eşlerden her biri boşanma davası açabilir.

MADDE 174
Mevcut veya beklenen menfaatleri boşanma yüzünden zedelenen kusursuz veya daha az kusurlu taraf, kusurlu taraftan uygun bir maddi tazminat isteyebilir. Kişilik hakkı saldırıya uğrayan taraf manevi tazminat isteyebilir.

MADDE 175
Boşanma yüzünden yoksulluğa düşecek taraf nafaka isteyebilir.`;

const obligationsCode = {
  legislationId: "tbk",
  number: "6098",
  name: "Türk Borçlar Kanunu",
  type: "Kanun",
  series: "5",
  officialGazetteDate: "04.02.2011",
  officialGazetteNumber: "27836",
  url: null,
};

const obligationsCodeText = `MADDE 350
Kiraya veren, kira sözleşmesini; kiralananı kendisi, eşi, altsoyu, üstsoyu veya kanun gereği bakmakla yükümlü olduğu diğer kişiler için konut ya da işyeri gereksinimi sebebiyle kullanma zorunluluğu varsa belirli süreli sözleşmelerde sürenin sonunda açacağı dava ile sona erdirebilir.

MADDE 351
Kiralananı sonradan edinen kişi, kendisi veya kanunda sayılan yakınları için konut ya da işyeri gereksinimi sebebiyle kullanma zorunluluğu varsa sözleşmeyi dava yoluyla sona erdirebilir.`;

const originalSemanticCandidates = process.env.SEMANTIC_CANDIDATES;
const originalSemanticMinScore = process.env.SEMANTIC_MIN_SCORE;

afterEach(() => {
  if (originalSemanticCandidates == null) delete process.env.SEMANTIC_CANDIDATES;
  else process.env.SEMANTIC_CANDIDATES = originalSemanticCandidates;
  if (originalSemanticMinScore == null) delete process.env.SEMANTIC_MIN_SCORE;
  else process.env.SEMANTIC_MIN_SCORE = originalSemanticMinScore;
});

beforeEach(() => {
  vi.mocked(complete).mockReset();
  vi.mocked(searchDecisions).mockReset();
  vi.mocked(getDecisionDocument).mockReset();
  vi.mocked(verifyDecisionDocument).mockReset();
  vi.mocked(searchLegislation).mockReset();
  vi.mocked(getLegislationDocument).mockReset();
  vi.mocked(readDecisionCache).mockReset();
  vi.mocked(writeDecisionCache).mockReset();
  vi.mocked(readLegislationCache).mockReset();
  vi.mocked(writeLegislationCache).mockReset();
  vi.mocked(semanticRerank).mockReset();

  vi.mocked(searchDecisions).mockResolvedValue({ total: 0, decisions: [] });
  vi.mocked(searchLegislation).mockResolvedValue({ total: 0, documents: [] });
  vi.mocked(readDecisionCache).mockResolvedValue(null);
  vi.mocked(readLegislationCache).mockResolvedValue(null);
  vi.mocked(writeDecisionCache).mockResolvedValue(undefined);
  vi.mocked(writeLegislationCache).mockResolvedValue(undefined);
  vi.mocked(verifyDecisionDocument).mockReturnValue({ verified: true });
  vi.mocked(semanticRerank).mockImplementation(async (_query, documents) => ({
    provider: "deepseek-rerank",
    results: documents.map((document, index) => ({ id: document.id, score: 0.9 - index * 0.05 })),
  }));
});

describe("hukukî sorgu ve madde seçimi", () => {
  it("genel personel ifadelerini boşanma sorusu için güçlü eşleşme saymaz", () => {
    const result = decisionMatchesQuestion(
      "Boşanmada kusur belirlemesi ile maddi ve manevi tazminat koşulları",
      "Personelin maddi ve manevi hakları ile çalışma koşulları kurum tarafından belirlenir."
    );
    expect(result.matches.length).toBeLessThan(result.required);
  });

  it("karar ve mevzuat sorgularını Bedesten'in iki ayrı sözdizimine çevirir", () => {
    expect(bedestenBooleanQuery("eski türk lirası ipoteklerinin kaldırılması")).toBe(
      'ipoteklerinin AND kaldırılması AND "türk lirası"'
    );
    expect(bedestenBooleanQuery('ipotek* AND "türk lirası"')).toBe('ipotek AND "türk lirası"');
    expect(legislationSolrQuery("boşanma kusur tazminat")).toBe("+tazminat +boşanma +kusur");
  });

  it("tam belgeden yalnızca aynı maddede birlikte eşleşen maddeyi çıkarır", () => {
    const excerpt = relevantLegislationArticles(civilCodeText, "boşanma AND tazminat");
    expect(excerpt).toContain("MADDE 174");
    expect(excerpt).not.toContain("MADDE 166");
    expect(excerpt).not.toContain("MADDE 175");
  });
});

describe("tek turlu araştırma akışı", () => {
  it("ihtiyacı biçimini tahliye rotasına bağlar, TBK 350'yi ve yalnızca ilgili kararı getirir", async () => {
    const unrelated = decisionSummary("1111", {
      court: "İstinaf Hukuk Kararı",
      chamber: "8. Hukuk Dairesi",
    });
    const relevant = decisionSummary("2222", {
      chamber: "3. Hukuk Dairesi",
      esasNo: "2017/7019",
      kararNo: "2017/17123",
    });
    vi.mocked(searchDecisions).mockResolvedValue({ total: 2, decisions: [unrelated, relevant] });
    vi.mocked(getDecisionDocument)
      .mockResolvedValueOnce({ mimeType: "text/html", text: "Trafik kazası sonrası bakıcı ihtiyacı ve bedensel zarar. ".repeat(20) })
      .mockResolvedValueOnce({ mimeType: "text/html", text: "Konut ihtiyacı nedeniyle tahliye için ihtiyacın gerçek, samimi ve zorunlu olması gerekir. ".repeat(20) });
    vi.mocked(semanticRerank).mockResolvedValue({
      provider: "deepseek-rerank",
      results: [{ id: "1111", score: 0.98 }, { id: "2222", score: 0.91 }],
    });
    vi.mocked(searchLegislation).mockResolvedValue({ total: 1, documents: [obligationsCode] });
    vi.mocked(getLegislationDocument).mockResolvedValue({ text: obligationsCodeText, mimeType: "text/html" });

    const answer = await researchAndAnswer(
      "Konut ihtiyacı nedeniyle tahliye davasının şartları ve ispatı nasıl değerlendirilir?",
      vi.fn(),
      undefined,
      ["YARGITAY", "ISTINAF", "MEVZUAT"],
      "sources"
    );

    expect(searchDecisions).toHaveBeenCalledWith(expect.objectContaining({ phrase: '"ihtiyaç nedeniyle tahliye"' }));
    expect(searchLegislation).toHaveBeenCalledWith(expect.objectContaining({ name: "Türk Borçlar Kanunu", number: "6098" }));
    expect(answer.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "legislation", number: "6098", excerpt: expect.stringContaining("MADDE 350") }),
      expect.objectContaining({ kind: "decision", documentId: "2222" }),
    ]));
    expect(answer.sources).not.toEqual(expect.arrayContaining([expect.objectContaining({ documentId: "1111" })]));
    expect(answer.searchedSources).toEqual(["YARGITAY", "ISTINAF", "MEVZUAT"]);
  });

  it("boşanma sorusunda personel yönetmeliğini indirmeden eler ve TMK 174'ü gösterir", async () => {
    vi.mocked(searchLegislation).mockResolvedValue({ total: 2, documents: [personnel, civilCode] });
    vi.mocked(getLegislationDocument).mockResolvedValue({ text: civilCodeText, mimeType: "text/html" });

    const answer = await researchAndAnswer(
      "Boşanma davasında kusur belirlemesi ile maddi ve manevi tazminat koşulları nasıl değerlendirilir?",
      vi.fn(),
      undefined,
      ["MEVZUAT"],
      "sources"
    );

    expect(searchLegislation).toHaveBeenCalledWith({
      phrase: undefined,
      name: "Türk Medeni Kanunu",
      number: "4721",
      types: ["KANUN"],
      page: 1,
    });
    expect(getLegislationDocument).toHaveBeenCalledTimes(1);
    expect(getLegislationDocument).toHaveBeenCalledWith("tmk");
    expect(answer.sources).toHaveLength(1);
    expect(answer.sources[0]).toMatchObject({ kind: "legislation", name: "Türk Medeni Kanunu", number: "4721" });
    expect(answer.sources[0].excerpt).toContain("MADDE 174");
    expect(answer.sources[0].excerpt).not.toContain("MADDE 166");
    expect(complete).not.toHaveBeenCalled();
  });

  it("bilinmeyen konuda modeli araç döngüsü yerine yalnızca bir kez planlayıcı olarak çağırır", async () => {
    vi.mocked(complete).mockResolvedValueOnce(
      toolCallMessage("arama_plani_yaz", {
        decisionQuery: "yürütmenin durdurulması AND telafisi güç zarar",
        legislation: [{
          phrase: "yürütmenin durdurulması",
          name: "İdari Yargılama Usulü Kanunu",
          number: "2577",
          types: ["KANUN"],
          articleQuery: "telafisi AND güç",
        }],
      })
    );
    vi.mocked(searchLegislation).mockResolvedValue({
      total: 1,
      documents: [{ ...civilCode, legislationId: "iyuk", number: "2577", name: "İDARİ YARGILAMA USULÜ KANUNU" }],
    });
    vi.mocked(getLegislationDocument).mockResolvedValue({
      mimeType: "text/html",
      text: "MADDE 27\nDanıştay veya idari mahkemeler, idari işlemin uygulanması hâlinde telafisi güç veya imkânsız zararların doğması ve işlemin açıkça hukuka aykırı olması şartlarının birlikte gerçekleşmesi durumunda yürütmenin durdurulmasına karar verebilir.",
    });

    const answer = await researchAndAnswer(
      "İdari işlemin yürütmesinin durdurulması için hangi şartlar aranır?",
      vi.fn(),
      undefined,
      ["MEVZUAT"],
      "sources"
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(vi.mocked(complete).mock.calls[0][0].toolChoice).toEqual({
      type: "function",
      function: { name: "arama_plani_yaz" },
    });
    expect(answer.sources[0].excerpt).toContain("MADDE 27");
  });

  it("seçilen karar koleksiyonlarında en fazla iki ilgili kararı doğrular", async () => {
    const first = decisionSummary("1111");
    const second = decisionSummary("2222", { chamber: "Hukuk Genel Kurulu", esasNo: "2022/12", kararNo: "2023/44" });
    vi.mocked(searchDecisions).mockResolvedValue({ total: 2, decisions: [first, second] });
    vi.mocked(getDecisionDocument).mockResolvedValue({
      mimeType: "text/html",
      text: `${"Kira tespit davasında emsal kira ve hakkaniyet indirimi değerlendirilmiştir. ".repeat(8)}`,
    });

    const answer = await researchAndAnswer(
      "Kira tespit davasında emsal kira bedeli ve hakkaniyet indirimi nasıl belirlenir?",
      vi.fn(),
      undefined,
      ["YARGITAY", "ISTINAF"],
      "sources"
    );

    expect(searchDecisions).toHaveBeenCalledWith(expect.objectContaining({
      phrase: '"kira tespit" AND "hakkaniyet indirimi"',
      courtTypes: ["YARGITAYKARARI", "ISTINAFHUKUK"],
    }));
    expect(answer.sources).toHaveLength(2);
    expect(answer.sources.every((source) => source.kind === "decision")).toBe(true);
    expect(semanticRerank).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it("doğrulanmış karar adaylarını semantik puana göre sıralar", async () => {
    const first = decisionSummary("1111");
    const second = decisionSummary("2222", { esasNo: "2022/12", kararNo: "2023/44" });
    vi.mocked(searchDecisions).mockResolvedValue({ total: 2, decisions: [first, second] });
    vi.mocked(getDecisionDocument)
      .mockResolvedValueOnce({ mimeType: "text/html", text: "Kira bedeli ve tahliye. ".repeat(30) })
      .mockResolvedValueOnce({ mimeType: "text/html", text: "Geçersiz fesih ve işe iade. ".repeat(30) });
    vi.mocked(semanticRerank).mockResolvedValue({
      provider: "deepseek-rerank",
      results: [{ id: "2222", score: 0.96 }, { id: "1111", score: 0.2 }],
    });

    const answer = await researchAndAnswer(
      "İş sözleşmesinin geçersiz feshi sonrası işe iade",
      vi.fn(),
      undefined,
      ["YARGITAY"],
      "sources"
    );

    expect(answer.sources).toHaveLength(1);
    expect(answer.sources[0]).toMatchObject({ kind: "decision", documentId: "2222" });
  });

  it("ilgili kararları seçtikten sonra sonuçları en yeni tarihten eskiye dizer", async () => {
    const older = decisionSummary("1111", { date: "03.04.2021" });
    const newer = decisionSummary("2222", {
      date: "12.09.2024",
      esasNo: "2024/12",
      kararNo: "2024/44",
    });
    vi.mocked(searchDecisions).mockResolvedValue({ total: 2, decisions: [older, newer] });
    vi.mocked(getDecisionDocument).mockResolvedValue({
      mimeType: "text/html",
      text: "İşe iade davasında geçersiz fesih ve işe başlatmama tazminatı değerlendirilmiştir. ".repeat(20),
    });
    // Eski karar anlam puanında önde olsa da sonuç listesinde tarih sırası
    // geçerlidir; anlam puanı yalnızca hangi adayların seçileceğini belirler.
    vi.mocked(semanticRerank).mockResolvedValue({
      provider: "deepseek-rerank",
      results: [{ id: "1111", score: 0.97 }, { id: "2222", score: 0.86 }],
    });

    const answer = await researchAndAnswer(
      "İşe iade davasında geçersiz fesih",
      vi.fn(),
      undefined,
      ["YARGITAY"],
      "sources"
    );

    expect(answer.sources.filter((source) => source.kind === "decision").map((source) => source.documentId)).toEqual(["2222", "1111"]);
  });

  it("aday sınırı 10'u aşarsa Bedesten'in sonraki sayfalarını da tarar", async () => {
    process.env.SEMANTIC_CANDIDATES = "11";
    const firstPage = Array.from({ length: 10 }, (_, index) => decisionSummary(String(1000 + index)));
    const secondPage = [decisionSummary("2000")];
    vi.mocked(searchDecisions).mockImplementation(async ({ page }) => ({
      total: 11,
      decisions: page === 2 ? secondPage : firstPage,
    }));
    vi.mocked(getDecisionDocument).mockResolvedValue({
      mimeType: "text/html",
      text: "Geçersiz fesih ve işe iade uyuşmazlığı incelenmiştir. ".repeat(20),
    });

    await researchAndAnswer(
      "İşe iade davasında geçersiz fesih",
      vi.fn(),
      undefined,
      ["YARGITAY"],
      "sources"
    );

    expect(searchDecisions).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(semanticRerank).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ id: "2000" })]),
      undefined
    );
  });

  it("analiz modunda kaynak topladıktan sonra yalnızca bir sentez çağrısı yapar", async () => {
    vi.mocked(searchLegislation).mockResolvedValue({ total: 1, documents: [civilCode] });
    vi.mocked(getLegislationDocument).mockResolvedValue({ text: civilCodeText, mimeType: "text/html" });
    vi.mocked(complete).mockResolvedValueOnce(
      toolCallMessage("dogrulanmis_cevap_yaz", {
        title: "Sonuç",
        summary: "TMK 174 tazminat koşullarını düzenler.",
        summarySourceIds: ["M1"],
        sections: [],
        limitations: [],
      })
    );

    const answer = await researchAndAnswer(
      "Boşanma davasında kusur ve tazminat nasıl değerlendirilir?",
      vi.fn(),
      undefined,
      ["MEVZUAT"],
      "analysis"
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(answer.title).toBe("Sonuç");
  });
});

describe("model katmanı seçimi", () => {
  it("arama planını ucuz katmanda, sentezi güçlü katmanda muhakeme açık çalıştırır", async () => {
    // Bilinen rotalara uymayan bir soru: plan çağrısı gerçekten yapılır.
    const question = "Kat karşılığı inşaat sözleşmesinde arsa sahibinin temerrüdü nasıl değerlendirilir?";

    vi.mocked(complete)
      .mockResolvedValueOnce(
        toolCallMessage("arama_plani_yaz", {
          decisionQuery: "kat karşılığı AND temerrüt",
          legislation: [],
        })
      )
      .mockResolvedValueOnce(
        toolCallMessage("dogrulanmis_cevap_yaz", {
          title: "Kat karşılığı inşaat",
          summary: "Özet",
          summarySourceIds: ["K1"],
          sections: [],
          limitations: [],
        })
      );
    vi.mocked(searchDecisions).mockResolvedValue({ total: 1, decisions: [decisionSummary("3333")] });
    vi.mocked(getDecisionDocument).mockResolvedValue({
      mimeType: "text/html",
      text: "Kat karşılığı inşaat sözleşmesinde arsa sahibinin temerrüdü ve yükleniciye etkisi. ".repeat(20),
    });
    vi.mocked(semanticRerank).mockResolvedValue({
      provider: "deepseek-rerank",
      results: [{ id: "3333", score: 0.95 }],
    });

    await researchAndAnswer(question, vi.fn(), undefined, ["YARGITAY"], "analysis");

    const [planCall, synthesisCall] = vi.mocked(complete).mock.calls.map((call) => call[0]);

    expect(planCall.tier).toBe("fast");
    expect(planCall.reasoning).toBeUndefined();

    expect(synthesisCall.tier).toBe("pro");
    expect(synthesisCall.reasoning).toBe(true);
  });
});

describe("anlamsal eleme eşiği", () => {
  const question = "Konut ihtiyacı nedeniyle tahliye davasının şartları nasıl değerlendirilir?";
  // Her iki karar da kelime eşleşmesinden geçer. Böylece aradaki tek fark
  // anlamsal puan olur ve eşiğin etkisi yalıtılmış biçimde ölçülür; aksi
  // hâlde seçim boş kalınca devreye giren kelime yedeği sonucu gizler.
  const body = "Konut ihtiyacı nedeniyle tahliye için ihtiyacın gerçek, samimi ve zorunlu olması gerekir. ".repeat(20);

  async function runWithScores(
    provider: "openai-embedding" | "deepseek-rerank",
    strong: number,
    weak: number
  ) {
    vi.mocked(searchDecisions).mockResolvedValue({
      total: 2,
      decisions: [
        decisionSummary("9001", { chamber: "3. Hukuk Dairesi" }),
        decisionSummary("9002", { chamber: "6. Hukuk Dairesi" }),
      ],
    });
    vi.mocked(getDecisionDocument).mockResolvedValue({ mimeType: "text/html", text: body });
    vi.mocked(semanticRerank).mockResolvedValue({
      provider,
      results: [{ id: "9001", score: strong }, { id: "9002", score: weak }],
    });

    const answer = await researchAndAnswer(question, vi.fn(), undefined, ["YARGITAY"], "sources");
    return answer.sources.map((source) => (source as { documentId?: string }).documentId);
  }

  it("embedding sağlayıcısında kendi eşiğini uygular", async () => {
    // 0,33 embedding kosinüsünde güçlü bir eşleşmedir. Eski sabit 0,42 eşiği
    // iki kararı da eleyip kelime yedeğine düşer ve ikisini birden döndürürdü.
    expect(await runWithScores("openai-embedding", 0.33, 0.11)).toEqual(["9001"]);
  });

  it("DeepSeek puanlamasında daha yüksek olan kendi eşiğini uygular", async () => {
    // Aynı 0,33 puanı DeepSeek ölçeğinde zayıftır ve elenmelidir.
    expect(await runWithScores("deepseek-rerank", 0.5, 0.33)).toEqual(["9001"]);
  });

  it("SEMANTIC_MIN_SCORE verilirse sağlayıcı varsayılanını ezer", async () => {
    process.env.SEMANTIC_MIN_SCORE = "0.05";

    expect(await runWithScores("openai-embedding", 0.33, 0.11)).toEqual(["9001", "9002"]);
  });
});
