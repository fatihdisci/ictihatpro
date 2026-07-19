import { z } from "zod";
import {
  assertTrustedOrigin,
  clearSessionCookie,
  clientAddress,
  isAuthorized,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({ password: z.string().min(1).max(512) }).strict();

export async function GET() {
  return Response.json(
    {
      authenticated: await isAuthorized(),
      configured: Boolean(process.env.APP_PASSWORD && process.env.SESSION_SECRET),
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!(await assertTrustedOrigin(request))) {
    return Response.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
  }
  const address = clientAddress(request);
  const limit = rateLimit(`login:${address}`, 8, 15 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Çok fazla giriş denemesi" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = loginSchema.parse(await request.json());
    if (!verifyPassword(body.password)) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return Response.json({ error: "Parola hatalı" }, { status: 401 });
    }
    await setSessionCookie(request);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Geçersiz giriş" : (error as Error).message;
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await assertTrustedOrigin(request))) {
    return Response.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
  }
  await clearSessionCookie(request);
  return Response.json({ ok: true });
}
