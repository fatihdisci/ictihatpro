import { describe, expect, it } from "vitest";
import { getDecisionDocument, searchDecisions, verifyDecisionDocument } from "../lib/bedesten";

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
});
