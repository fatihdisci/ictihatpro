import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_SCORE, semanticRerank } from "../lib/semantic";

const live = process.env.LIVE_SEMANTIC === "1" ? describe : describe.skip;

const RELEVANT = "İşverenin geçerli sebep göstermeden çıkardığı işçinin işine geri dönmesi";

live("canlı semantik sıralama", () => {
  it(
    "farklı kelimelerle anlatılan işe iade kararını kira kararının önüne alır",
    async () => {
      const ranked = await semanticRerank(RELEVANT, [
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

  it(
    "sağlayıcının varsayılan eşiği ilgili kararı geçirip ilgisizi eler",
    async () => {
      // Eşik değerleri sağlayıcıya göre tahmin edilmiştir. Bu test gerçek
      // anahtarla çalıştırıldığında varsayımı doğrular: ilgili karar eşiğin
      // üstünde, ilgisiz karar altında kalmalıdır. Başarısız olursa
      // DEFAULT_MIN_SCORE ayarlanmalı veya SEMANTIC_MIN_SCORE verilmelidir.
      const ranked = await semanticRerank(RELEVANT, [
        {
          id: "ilgisiz",
          text: "Taşınmazın ortaklığının giderilmesi ve aynen taksim koşulları değerlendirilmiştir.",
        },
        {
          id: "ilgili",
          text: "Feshin geçersizliği tespit edilerek işçinin işe iadesine ve boşta geçen süre ücretine hükmedilmiştir.",
        },
      ]);

      const threshold = DEFAULT_MIN_SCORE[ranked.provider];
      const score = (id: string) => ranked.results.find((result) => result.id === id)!.score;

      console.info(
        `[${ranked.provider}] eşik=${threshold} ilgili=${score("ilgili").toFixed(3)} ilgisiz=${score("ilgisiz").toFixed(3)}`
      );

      expect(score("ilgili")).toBeGreaterThanOrEqual(threshold);
      expect(score("ilgisiz")).toBeLessThan(threshold);
    },
    120_000
  );
});
