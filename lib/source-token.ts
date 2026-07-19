import { createHmac, timingSafeEqual } from "node:crypto";

type TokenEnvelope = {
  version: 1;
  kind: string;
  expiresAt: number;
  payload: unknown;
};

function tokenKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalı");
  return `${secret}:ictihat-mcp-source-token:v1`;
}

function signature(encoded: string): Buffer {
  return createHmac("sha256", tokenKey()).update(encoded).digest();
}

export function issueSourceToken(kind: string, payload: unknown, ttlSeconds = 30 * 60): string {
  const envelope: TokenEnvelope = {
    version: 1,
    kind,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
    payload,
  };
  const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifySourceToken(token: string, expectedKind: string): unknown {
  if (token.length > 6000) throw new Error("Kaynak belirteci çok uzun");
  const [encoded, suppliedSignature, ...extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra.length > 0) throw new Error("Geçersiz kaynak belirteci");

  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = signature(encoded);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Kaynak belirteci doğrulanamadı");
  }

  let envelope: TokenEnvelope;
  try {
    envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenEnvelope;
  } catch {
    throw new Error("Kaynak belirteci çözülemedi");
  }
  if (envelope.version !== 1 || envelope.kind !== expectedKind) throw new Error("Kaynak belirteci türü geçersiz");
  if (!Number.isInteger(envelope.expiresAt) || envelope.expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error("Kaynak belirtecinin süresi doldu; yeniden arama yapın");
  }
  return envelope.payload;
}
