import { afterEach, describe, expect, it, vi } from "vitest";
import { complete } from "../lib/deepseek";
import { cosineSimilarity, semanticRerank } from "../lib/semantic";

vi.mock("../lib/deepseek", () => ({ complete: vi.fn() }));

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  vi.unstubAllGlobals();
  vi.mocked(complete).mockReset();
});

describe("semantik karar sıralaması", () => {
  it("normalize edilmiş embedding vektörlerinin kosinüs yakınlığını hesaplar", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("OpenRouter varsa Said'in yaklaşımı gibi embedding ile yeniden sıralar", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [0, 1] },
          { index: 2, embedding: [0.9, 0.1] },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ranked = await semanticRerank("muris muvazaası", [
      { id: "ilgisiz", text: "Kira uyuşmazlığı" },
      { id: "ilgili", text: "Miras bırakanın muvazaalı temliki" },
    ]);

    expect(ranked.provider).toBe("openrouter-embedding");
    expect(ranked.results[0].id).toBe("ilgili");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it("OpenRouter yoksa mevcut DeepSeek bağlantısını yalnızca puanlayıcı olarak kullanır", async () => {
    vi.mocked(complete).mockResolvedValue({
      role: "assistant",
      tool_calls: [{
        id: "rank",
        type: "function",
        function: {
          name: "kararlari_anlamsal_sirala",
          arguments: JSON.stringify({ results: [{ id: "a", score: 22 }, { id: "b", score: 91 }] }),
        },
      }],
    });

    const ranked = await semanticRerank("işe iade", [
      { id: "a", text: "Kira bedelinin tespiti" },
      { id: "b", text: "Geçersiz fesih sonrası işe başlatma" },
    ]);

    expect(ranked.provider).toBe("deepseek-rerank");
    expect(ranked.results.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
