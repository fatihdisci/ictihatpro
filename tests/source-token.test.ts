import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueSourceToken, verifySourceToken } from "../lib/source-token";

const originalSecret = process.env.SESSION_SECRET;

describe("MCP kaynak belirteci", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    if (originalSecret == null) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("imzalı veriyi aynı tür için doğrular", () => {
    const token = issueSourceToken("decision", { documentId: "1234" });
    expect(verifySourceToken(token, "decision")).toEqual({ documentId: "1234" });
  });

  it("değiştirilmiş veya başka türdeki belirteci reddeder", () => {
    const token = issueSourceToken("decision", { documentId: "1234" });
    expect(() => verifySourceToken(`${token}x`, "decision")).toThrow("doğrulanamadı");
    expect(() => verifySourceToken(token, "legislation")).toThrow("türü geçersiz");
  });
});
