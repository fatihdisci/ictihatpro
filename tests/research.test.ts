import { beforeEach, describe, expect, it, vi } from "vitest";
import { bedestenBooleanQuery, decisionMatchesQuestion, researchAndAnswer } from "../lib/research";
import { complete } from "../lib/deepseek";
import { getDecisionDocument, searchDecisions, verifyDecisionDocument } from "../lib/bedesten";
import { readDecisionCache, writeDecisionCache } from "../lib/cache";

vi.mock("../lib/deepseek", () => ({ complete: vi.fn() }));
vi.mock("../lib/bedesten", () => ({
  COURT_TYPES: { HEPSI: "HEPSI" },
  searchDecisions: vi.fn(),
  getDecisionDocument: vi.fn(),
  verifyDecisionDocument: vi.fn(),
}));
vi.mock("../lib/cache", () => ({ readDecisionCache: vi.fn(), writeDecisionCache: vi.fn() }));

function decisionSummary(documentId: string, overrides: Record<string, unknown> = {}) {
  return {
    documentId,
    court: "Yargıtay Kararı",
    chamber: "9. Hukuk Dairesi",
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

function synthesisMessage(payload: Record<string, unknown>) {
  return { role: "assistant" as const, content: JSON.stringify(payload) };
}

beforeEach(() => {
  vi.mocked(complete).mockReset();
  vi.mocked(searchDecisions).mockReset();
  vi.mocked(getDecisionDocument).mockReset();
  vi.mocked(verifyDecisionDocument).mockReset();
  vi.mocked(readDecisionCache).mockReset();
  vi.mocked(writeDecisionCache).mockReset();
  vi.mocked(readDecisionCache).mockResolvedValue(null);
  vi.mocked(writeDecisionCache).mockResolvedValue(undefined);
  vi.mocked(verifyDecisionDocument).mockReturnValue({ verified: true });
});

describe("araştırma sentezi", () => {
  it("soru kavramlarını taşımayan doğrulanmış ama ilgisiz kararı eler", () => {
    const unrelated = decisionMatchesQuestion(
      "Eski Türk lirası ipoteklerinin kaldırılmasına ilişkin içtihatları bul getir",
      "Sanığın kaçakçılık suçundan mahkumiyetine ilişkin ceza kararı."
    );
    const related = decisionMatchesQuestion(
      "Eski Türk lirası ipoteklerinin kaldırılmasına ilişkin içtihatları bul getir",
      "Tapu kaydındaki ipotek Türk Lirası üzerinden kurulmuş olup ipoteğin kaldırılması istenmiştir."
    );

    expect(unrelated.matches.length).toBeLessThan(unrelated.required);
    expect(related.matches.length).toBeGreaterThanOrEqual(related.required);
  });

  it("doğal sorguyu joker kullanmadan Bedesten Boolean aramasına dönüştürür", () => {
    // Bedesten `*` içeren sorguyu bütünüyle reddettiği için sorguda joker olamaz.
    expect(bedestenBooleanQuery("eski türk lirası ipoteklerinin kaldırılması")).toBe(
      'ipoteklerinin AND kaldırılması AND "türk lirası"'
    );
    expect(bedestenBooleanQuery('ipotek AND "türk lirası"')).toBe('ipotek AND "türk lirası"');
    expect(bedestenBooleanQuery('ipotek* AND fek')).toBe("ipotek AND fek");
    expect(bedestenBooleanQuery("ipotek* fekki")).toBe("ipotek AND fekki");
  });

  it("kaynak kartına kararın Bedesten sayfasını işaret eden link yazar", async () => {
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("987654")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "987654" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(
        toolCallMessage("dogrulanmis_cevap_yaz", {
          title: "Sonuç",
          summary: "Karar değerlendirmesi.",
          summarySourceIds: ["K1"],
          sections: [],
          limitations: [],
        }, "synthesis")
      );

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(answer.sources[0].sourceUrl).toBe("https://mevzuat.adalet.gov.tr/ictihat/987654");
    expect(vi.mocked(complete).mock.calls[3][0].toolChoice).toEqual({
      type: "function",
      function: { name: "dogrulanmis_cevap_yaz" },
    });
  });

  it("model istedikçe kaynak kotasına kadar birden çok kararı doğrular", async () => {
    const first = decisionSummary("111", { esasNo: "2020/11", kararNo: "2021/22" });
    const second = decisionSummary("222", { chamber: "12. Hukuk Dairesi", esasNo: "2019/33", kararNo: "2020/44" });
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [first, second] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "111" }, "read-1"))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "222" }, "read-2"))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(
        synthesisMessage({
          title: "Sonuç",
          summary: "Kararların değerlendirmesi.",
          summarySourceIds: ["K1", "K2"],
          sections: [{ heading: "Gerekçe", text: "Ortak değerlendirme.", sourceIds: ["K1", "K2"] }],
          limitations: [],
        })
      );

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(answer.sources.map((source) => source.id)).toEqual(["K1", "K2"]);
    expect(vi.mocked(getDecisionDocument).mock.calls.map(([id]) => id)).toEqual(["111", "222"]);
  });

  it("model tek kararda durursa ikinci adayı sunucu doğrular", async () => {
    const first = decisionSummary("111", { esasNo: "2020/11", kararNo: "2021/22" });
    const second = decisionSummary("222", { chamber: "12. Hukuk Dairesi", esasNo: "2019/33", kararNo: "2020/44" });
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [first, second] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "111" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Tek karar yeterli." })
      .mockResolvedValueOnce(
        synthesisMessage({
          title: "Sonuç",
          summary: "Kararların değerlendirmesi.",
          summarySourceIds: ["K1", "K2"],
          sections: [],
          limitations: [],
        })
      );

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(answer.sources).toHaveLength(2);
    expect(vi.mocked(getDecisionDocument)).toHaveBeenCalledWith("222");
  });

  it("model boş atıf dizileri döndürdüğünde yalnızca doğrulanmış kaynağı ilişkilendirir", async () => {
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("123")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "123" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(
        synthesisMessage({
          title: "Sonuç",
          summary: "Karar değerlendirmesi.",
          summarySourceIds: [],
          sections: [{ heading: "Gerekçe", text: "Gerekçe değerlendirmesi.", sourceIds: [] }],
          limitations: [],
        })
      );

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(vi.mocked(complete).mock.calls[0][0].toolChoice).toEqual({ type: "function", function: { name: "karar_ara" } });
    expect(vi.mocked(complete).mock.calls[1][0].toolChoice).toEqual({ type: "function", function: { name: "karar_oku" } });
    expect(answer.summarySourceIds).toEqual(["K1"]);
    expect(answer.sections[0].sourceIds).toEqual(["K1"]);
    expect(answer.limitations).toContain("Bazı atıf kimlikleri model tarafından boş bırakıldı; sunucu bunları yalnızca doğrulanmış kaynaklarla tamamladı.");
  });

  it("model aday metnini açmayı atladığında doğrulanabilir adayı sunucuda açar", async () => {
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("456")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(
        synthesisMessage({
          title: "Sonuç",
          summary: "Karar değerlendirmesi.",
          summarySourceIds: ["K1"],
          sections: [],
          limitations: [],
        })
      );
    const progress = vi.fn();

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", progress);

    expect(answer.sources).toHaveLength(1);
    expect(vi.mocked(getDecisionDocument)).toHaveBeenCalledWith("456");
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning", message: expect.stringContaining("model metni açmadığı") })
    );
  });

  it("kaynaktaki daireye doğal biçimde atıf yapan cevabı kabul eder", async () => {
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("123")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "123" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(
        synthesisMessage({
          title: "Sonuç",
          // Bedesten mahkeme adı "Yargıtay Kararı" olsa da modelin doğal
          // "Yargıtay 9. Hukuk Dairesi" atfı reddedilmemeli.
          summary: "Yargıtay 9. Hukuk Dairesi bu şartları aramaktadır.",
          summarySourceIds: ["K1"],
          sections: [],
          limitations: [],
        })
      );

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(answer.summary).toContain("Yargıtay 9. Hukuk Dairesi");
  });

  it("kaynaklarda olmayan bir daire atfında hukukî değerlendirme üretmez", async () => {
    const badSynthesis = synthesisMessage({
      title: "Sonuç",
      summary: "Yargıtay 21. Hukuk Dairesi aksi yönde karar vermiştir.",
      summarySourceIds: ["K1"],
      sections: [],
      limitations: [],
    });
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("123")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "123" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce(badSynthesis)
      .mockResolvedValueOnce(badSynthesis);

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());
    expect(answer.title).toBe("Doğrulanmış kaynaklar getirildi");
    expect(answer.sections).toEqual([]);
  });

  it("model iki kez bozuk JSON üretirse doğrulanmış kaynakları hata yerine güvenli geri dönüşle gösterir", async () => {
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [decisionSummary("123")] } as never);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(complete)
      .mockResolvedValueOnce(toolCallMessage("karar_ara", { ifade: "kıdem tazminatı" }))
      .mockResolvedValueOnce(toolCallMessage("karar_oku", { document_id: "123" }))
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce({ role: "assistant", content: '{"title":"yarım' })
      .mockResolvedValueOnce({ role: "assistant", content: '{"summary":"yine yarım' });

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(answer.title).toBe("Doğrulanmış kaynaklar getirildi");
    expect(answer.sources).toHaveLength(1);
    expect(answer.limitations[0]).toContain("ayrıştırılamadığı");
  });
});
