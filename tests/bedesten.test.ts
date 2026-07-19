import { describe, expect, it } from "vitest";
import {
  plausibleDecisionDate,
  verifyDecisionDocument,
  type DecisionSummary,
} from "../lib/bedesten";

const summary: DecisionSummary = {
  documentId: "123456",
  court: "Yargıtay Kararı",
  chamber: "9. Hukuk Dairesi",
  esasNo: "2023/1234",
  kararNo: "2024/5678",
  date: "12.03.2024",
  finalization: null,
};

describe("Bedesten metadata korumaları", () => {
  it("makul tarihleri tek biçime çevirir", () => {
    expect(plausibleDecisionDate("12.03.2024")).toBe("12.03.2024");
    expect(plausibleDecisionDate("2024-03-12T00:00:00Z")).toBe("12.03.2024");
  });

  it("bozuk ve gelecekteki tarihleri reddeder", () => {
    expect(plausibleDecisionDate("21.09.6006")).toBeNull();
    expect(plausibleDecisionDate("tarih yok")).toBeNull();
  });

  it("esas ve karar numaraları metinde yoksa kararı reddeder", () => {
    expect(verifyDecisionDocument(summary, "x".repeat(500)).verified).toBe(false);
  });

  it("esas ve karar numaraları metinde birlikteyse kararı doğrular", () => {
    const body = `Yargıtay 9. Hukuk Dairesi 2023/1234 E. 2024/5678 K.\n${"Gerekçe. ".repeat(80)}`;
    expect(verifyDecisionDocument(summary, body)).toEqual({ verified: true });
  });
});
