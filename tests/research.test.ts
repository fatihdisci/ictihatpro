import { beforeEach, describe, expect, it, vi } from "vitest";
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

  vi.mocked(searchDecisions).mockResolvedValue({ total: 0, decisions: [] });
  vi.mocked(searchLegislation).mockResolvedValue({ total: 0, documents: [] });
  vi.mocked(readDecisionCache).mockResolvedValue(null);
  vi.mocked(readLegislationCache).mockResolvedValue(null);
  vi.mocked(writeDecisionCache).mockResolvedValue(undefined);
  vi.mocked(writeLegislationCache).mockResolvedValue(undefined);
  vi.mocked(verifyDecisionDocument).mockReturnValue({ verified: true });
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
    expect(complete).not.toHaveBeenCalled();
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
