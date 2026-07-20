import { describe, expect, it } from "vitest";
import { getArticleDocument, getArticleTree, getGerekceDocument, searchLegislation } from "../lib/mevzuat";

// Bedesten gayriresmî bir uçtur ve şeması habersiz değişebilir. Bu test
// madde ağacı, tek madde ve gerekçe uçlarının sözleşmesini canlıda doğrular.
const live = process.env.LIVE_BEDESTEN === "1";

describe.runIf(live)("Bedesten madde uçları (canlı)", () => {
  it("Türk Medeni Kanunu'nun madde ağacını numaralı maddelere indirger", async () => {
    const found = await searchLegislation({ name: "Türk Medeni Kanunu", number: "4721", types: ["KANUN"] });
    const law = found.documents.find((document) => document.number === "4721");
    expect(law).toBeDefined();

    const articles = await getArticleTree(law!.legislationId);
    expect(articles.length).toBeGreaterThan(1000);
    expect(articles.every((article) => Number.isInteger(article.articleNo))).toBe(true);

    const first = articles[0];
    expect(first.articleNo).toBe(1);
    expect(first.title).toContain("Hukukun uygulanması");

    // Boşanmada kusur/tazminat maddesi: numarası servisten gelmeli.
    const article166 = articles.find((article) => article.articleNo === 166);
    expect(article166).toBeDefined();

    const document = await getArticleDocument(article166!.articleId);
    expect(document.text.length).toBeGreaterThan(100);
    expect(document.text).toMatch(/Madde\s*166/i);

    // Kitap/kısım/bölüm başlıkları üst yolda taşınmalı, madde olarak değil.
    expect(article166!.path.some((step) => /KİTAP|KISIM|BÖLÜM/i.test(step))).toBe(true);
  }, 120_000);

  it("Türk Ceza Kanunu maddesi için resmî gerekçeyi getirir", async () => {
    const found = await searchLegislation({ name: "Türk Ceza Kanunu", number: "5237", types: ["KANUN"] });
    const law = found.documents.find((document) => document.number === "5237");
    expect(law).toBeDefined();

    const articles = await getArticleTree(law!.legislationId);
    const withGerekce = articles.find((article) => article.gerekceId !== null);
    expect(withGerekce).toBeDefined();

    const gerekce = await getGerekceDocument(withGerekce!.gerekceId!);
    expect(gerekce.text).toMatch(/GEREKÇE/i);
  }, 120_000);
});
