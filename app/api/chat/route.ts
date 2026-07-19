import { z } from "zod";
import { assertTrustedOrigin, clientAddress, isAuthorized } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { RESEARCH_SOURCES, researchAndAnswer } from "@/lib/research";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z
  .object({
    question: z.string().trim().min(5).max(6000),
    sources: z.array(z.enum(RESEARCH_SOURCES)).min(1).max(RESEARCH_SOURCES.length).default([...RESEARCH_SOURCES]),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await assertTrustedOrigin(request))) {
    return Response.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
  }
  if (!(await isAuthorized())) {
    return Response.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 20_000) {
    return Response.json({ error: "İstek çok büyük" }, { status: 413 });
  }
  const limit = rateLimit(`chat:${clientAddress(request)}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Saatlik araştırma sınırı doldu" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let question: string;
  let sources: z.infer<typeof requestSchema>["sources"];
  try {
    const body = requestSchema.parse(await request.json());
    question = body.question;
    sources = body.sources;
  } catch (error) {
    const message = error instanceof z.ZodError ? "Soru 5-6000 karakter arasında olmalı" : "Geçersiz istek";
    return Response.json({ error: message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const answer = await researchAndAnswer(question, send, request.signal, sources);
        send({ type: "answer", answer });
        send({ type: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
