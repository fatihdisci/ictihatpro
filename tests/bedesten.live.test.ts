import { describe, expect, it } from "vitest";
import { getDecisionDocument, searchDecisions, verifyDecisionDocument } from "../lib/bedesten";
import { getLegislationDocument, searchLegislation } from "../lib/mevzuat";
import { relevantLegislationArticles } from "../lib/legal-search";

const live = process.env.LIVE_BEDESTEN === "1" ? describe : describe.skip;

live("Bedesten canlı uyumluluk", () => {
  it(
    "arama sonucunu indirip kimlik numaralarını metinde doğrular",
    async () => {
      const result = await searchDecisions({ phrase: "muvazaa", court: "YARGITAY", page: 1 });
      expect(result.decisions.length).toBeGreaterThan(0);
      const candidate = result.decisions[0];
      const document = await getDecisionDocument(candidate.documentId);
      expect(verifyDecisionDocument(candidate, document.text).verified).toBe(true);
    },
    60_000
  );

  it(
    "mevzuat arayıp resmî metni indirir",
    async () => {
      const result = await searchLegislation({ name: "Türk Borçlar Kanunu", number: "6098", types: ["KANUN"] });
      expect(result.documents.length).toBeGreaterThan(0);
      const document = await getLegislationDocument(result.documents[0].legislationId);
      expect(document.text.length).toBeGreaterThan(1000);
    },
    60_000
  );

  it(
    "boşanma tazminatı sorgusunu Türk Medeni Kanunu 174. maddeye indirger",
    async () => {
      const result = await searchLegislation({
        name: "Türk Medeni Kanunu",
        number: "4721",
        types: ["KANUN"],
      });
      const civilCode = result.documents.find((document) => document.number === "4721");
      expect(civilCode?.name.toLocaleLowerCase("tr-TR")).toContain("medeni kanunu");
      const document = await getLegislationDocument(civilCode!.legislationId);
      const excerpt = relevantLegislationArticles(document.text, "boşanma AND tazminat");
      expect(excerpt).toMatch(/MADDE\s+174/iu);
      expect(excerpt).not.toMatch(/MADDE\s+166/iu);
    },
    60_000
  );

  it(
    "konut ihtiyacı sorgusunu Türk Borçlar Kanunu'nun ilgili tahliye maddelerine indirger",
    async () => {
      const result = await searchLegislation({
        name: "Türk Borçlar Kanunu",
        number: "6098",
        types: ["KANUN"],
      });
      const obligationsCode = result.documents.find((document) => document.number === "6098");
      expect(obligationsCode?.name.toLocaleLowerCase("tr-TR")).toContain("borçlar kanunu");
      const document = await getLegislationDocument(obligationsCode!.legislationId);
      const excerpt = relevantLegislationArticles(document.text, "gereksinimi AND sona");
      expect(excerpt).toMatch(/MADDE\s+350/iu);
    },
    60_000
  );
});
