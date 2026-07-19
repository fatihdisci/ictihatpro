import { describe, expect, it } from "vitest";
import { semanticRerank } from "../lib/semantic";

const live = process.env.LIVE_SEMANTIC === "1" ? describe : describe.skip;

live("canlı semantik sıralama", () => {
  it(
    "farklı kelimelerle anlatılan işe iade kararını kira kararının önüne alır",
    async () => {
      const ranked = await semanticRerank("İşverenin geçerli sebep göstermeden çıkardığı işçinin işine geri dönmesi", [
        {
          id: "kira",
          text: "Kiralananın ihtiyaç nedeniyle tahliyesi ve kira bedelinin tespiti uyuşmazlığı incelenmiştir.",
        },
        {
          id: "is",
          text: "Fesih nedeninin açık ve kesin biçimde gösterilmemesi nedeniyle feshin geçersizliğine ve işçinin işe başlatılmasına karar verilmiştir.",
        },
      ]);

      expect(ranked.results[0].id).toBe("is");
      expect(ranked.results[0].score).toBeGreaterThan(ranked.results[1].score);
    },
    120_000
  );
});
