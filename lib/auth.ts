import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "ictihat_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET en az 32 karakter olmalı");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function equalText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production";
  return equalText(candidate, expected);
}

export function createSessionToken(): string {
  const payload = `${Date.now() + SESSION_SECONDS * 1000}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!equalText(parts[2], sign(payload))) return false;
  const expiresAt = Number(parts[0]);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function useSecureCookie(request: Request): boolean {
  const configured = (process.env.COOKIE_SECURE ?? "auto").toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  const proto = request.headers.get("x-forwarded-proto");
  return proto === "https" || new URL(request.url).protocol === "https:";
}

export async function setSessionCookie(request: Request): Promise<void> {
  (await cookies()).set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: useSecureCookie(request),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSessionCookie(request: Request): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: useSecureCookie(request),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function isAuthorized(): Promise<boolean> {
  if (!process.env.APP_PASSWORD && process.env.NODE_ENV !== "production") return true;
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  return token.length > 0 && verifySessionToken(token);
}

export async function assertTrustedOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = process.env.TRUSTED_ORIGIN?.replace(/\/$/, "");
  if (configured) return origin === configured;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return false;
  return new URL(origin).host === host;
}

export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
