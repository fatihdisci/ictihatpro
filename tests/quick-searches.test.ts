import { describe, expect, it } from "vitest";
import { QUICK_SEARCHES } from "../app/_lib/types";
import { hasKnownResearchRoute } from "../lib/research";

describe("hazır araştırmalar", () => {
  it("geniş bir konu kümesini kapsar ve her kartta mevzuat ile karar araması açıktır", () => {
    expect(QUICK_SEARCHES.length).toBeGreaterThanOrEqual(35);
    expect(new Set(QUICK_SEARCHES.map((search) => search.label)).size).toBe(QUICK_SEARCHES.length);
    expect([...new Set(QUICK_SEARCHES.map((search) => search.category))]).toEqual(
      expect.arrayContaining(["Kira", "Aile", "İş", "İcra", "Miras", "Taşınmaz", "Tüketici", "Tazminat", "Ticaret", "Ceza", "İdare"])
    );

    for (const search of QUICK_SEARCHES) {
      expect(search.sources).toContain("MEVZUAT");
      expect(search.sources.some((source) => source !== "MEVZUAT")).toBe(true);
      expect(search.query.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("her hazır araştırma için karar ve mevzuat planı doğrudan belirlenir", () => {
    expect(QUICK_SEARCHES.filter((search) => !hasKnownResearchRoute(search.query)).map((search) => search.label)).toEqual([]);
  });
});
