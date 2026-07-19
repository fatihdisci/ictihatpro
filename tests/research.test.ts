import { describe, expect, it, vi } from "vitest";
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

  it("doğal sorguyu Bedesten Boolean aramasına dönüştürür", () => {
    expect(bedestenBooleanQuery("eski türk lirası ipoteklerinin kaldırılması")).toBe(
      'ipotek* AND kaldır* AND "türk lirası"'
    );
    expect(bedestenBooleanQuery('ipotek AND "türk lirası"')).toBe('ipotek AND "türk lirası"');
  });

  it("model boş atıf dizileri döndürdüğünde yalnızca doğrulanmış kaynağı ilişkilendirir", async () => {
    const summary = {
      documentId: "123",
      court: "Yargıtay Kararı",
      chamber: "9. Hukuk Dairesi",
      esasNo: "2023/1234",
      kararNo: "2024/5678",
      date: "12.03.2024",
      finalization: null,
    };
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [summary] } as never);
    vi.mocked(readDecisionCache).mockResolvedValue(null);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(writeDecisionCache).mockResolvedValue(undefined);
    vi.mocked(verifyDecisionDocument).mockReturnValue({ verified: true });
    vi.mocked(complete)
      .mockResolvedValueOnce({
        role: "assistant",
        tool_calls: [{ id: "search", type: "function", function: { name: "karar_ara", arguments: '{"ifade":"kıdem tazminatı"}' } }],
      })
      .mockResolvedValueOnce({
        role: "assistant",
        tool_calls: [{ id: "read", type: "function", function: { name: "karar_oku", arguments: '{"document_id":"123"}' } }],
      })
      .mockResolvedValueOnce({
        role: "assistant",
        content: JSON.stringify({
          title: "Sonuç",
          summary: "Karar değerlendirmesi.",
          summarySourceIds: [],
          sections: [{ heading: "Gerekçe", text: "Gerekçe değerlendirmesi.", sourceIds: [] }],
          limitations: [],
        }),
      });

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", vi.fn());

    expect(vi.mocked(complete).mock.calls[0][0].toolChoice).toEqual({ type: "function", function: { name: "karar_ara" } });
    expect(vi.mocked(complete).mock.calls[1][0].toolChoice).toEqual({ type: "function", function: { name: "karar_oku" } });
    expect(answer.summarySourceIds).toEqual(["K1"]);
    expect(answer.sections[0].sourceIds).toEqual(["K1"]);
    expect(answer.limitations).toContain("Bazı atıf kimlikleri model tarafından boş bırakıldı; sunucu bunları yalnızca doğrulanmış kaynaklarla tamamladı.");
  });

  it("model aday metnini açmayı atladığında doğrulanabilir ilk adayı sunucuda açar", async () => {
    const summary = {
      documentId: "456",
      court: "Yargıtay Kararı",
      chamber: "9. Hukuk Dairesi",
      esasNo: "2023/1234",
      kararNo: "2024/5678",
      date: "12.03.2024",
      finalization: null,
    };
    vi.mocked(searchDecisions).mockResolvedValue({ decisions: [summary] } as never);
    vi.mocked(readDecisionCache).mockResolvedValue(null);
    vi.mocked(getDecisionDocument).mockResolvedValue({ text: "Kıdem tazminatı şartları hakkında karar metni" } as never);
    vi.mocked(writeDecisionCache).mockResolvedValue(undefined);
    vi.mocked(verifyDecisionDocument).mockReturnValue({ verified: true });
    vi.mocked(complete)
      .mockResolvedValueOnce({
        role: "assistant",
        tool_calls: [{ id: "search", type: "function", function: { name: "karar_ara", arguments: '{"ifade":"kıdem tazminatı"}' } }],
      })
      .mockResolvedValueOnce({ role: "assistant", content: "Araştırma tamamlandı." })
      .mockResolvedValueOnce({
        role: "assistant",
        content: JSON.stringify({
          title: "Sonuç",
          summary: "Karar değerlendirmesi.",
          summarySourceIds: ["K1"],
          sections: [],
          limitations: [],
        }),
      });
    const progress = vi.fn();

    const answer = await researchAndAnswer("Kıdem tazminatı bakımından şartlar nelerdir?", progress);

    expect(answer.sources).toHaveLength(1);
    expect(vi.mocked(getDecisionDocument)).toHaveBeenCalledWith("456");
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning", message: expect.stringContaining("model metni açmadığı") })
    );
  });
});
