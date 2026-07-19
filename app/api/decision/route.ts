import { z } from "zod";
import { assertTrustedOrigin, clientAddress, isAuthorized } from "@/lib/auth";
import { getDecisionDocument } from "@/lib/bedesten";
import { readDecisionCache, writeDecisionCache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const idSchema = z.string().regex(/^\d{4,20}$/);

export async function GET(request: Request) {
  if (!(await assertTrustedOrigin(request))) {
    return Response.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
  }
  if (!(await isAuthorized())) {
    return Response.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const limit = rateLimit(`decision:${clientAddress(request)}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Saatlik karar görüntüleme sınırı doldu" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz karar numarası" }, { status: 400 });
  }
  const documentId = parsed.data;

  try {
    let document = await readDecisionCache(documentId);
    if (!document) {
      document = await getDecisionDocument(documentId);
      await writeDecisionCache(documentId, document);
    }
    return Response.json(
      { documentId, mimeType: document.mimeType, text: document.text },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Karar metni alınamadı";
    return Response.json({ error: message }, { status: 502 });
  }
}
