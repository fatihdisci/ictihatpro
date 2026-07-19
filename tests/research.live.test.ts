import { describe, expect, it } from "vitest";
import { researchAndAnswer } from "../lib/research";

const live = process.env.LIVE_RESEARCH === "1" ? describe : describe.skip;

live("canlı birleşik araştırma", () => {
  it(
    "konut ihtiyacı aramasında kararlarla birlikte Türk Borçlar Kanunu'nu da döndürür",
    async () => {
      const progress: unknown[] = [];
      const answer = await researchAndAnswer(
        "Konut ihtiyacı nedeniyle tahliye davasının şartları ve ispatı nasıl değerlendirilir?",
        (event) => progress.push(event),
        undefined,
        ["YARGITAY", "ISTINAF", "YEREL", "MEVZUAT"],
        "sources"
      );

      const decisions = answer.sources.filter((source) => source.kind === "decision");
      expect(decisions.length).toBeGreaterThan(2);
      const foundLegislation = answer.sources.some(
        (source) => source.kind === "legislation" && source.number === "6098" && /MADDE\s+350/iu.test(source.excerpt)
      );
      expect(
        foundLegislation,
        JSON.stringify({ progress, sources: answer.sources }, null, 2)
      ).toBe(true);
    },
    180_000
  );
});
