// app/api/chat/route.ts
// Araç döngüsünü sunucu tarafında çalıştırır, ilerlemeyi NDJSON olarak akıtır.

import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import type OpenAI from "openai";
import { getClient, SYSTEM_PROMPT, TOOLS, TUR_MAP } from "@/lib/llm";
import { search, getDocument } from "@/lib/bedesten";
import type { KararOzet } from "@/lib/bedesten";
import { getCached, putCached } from "@/lib/cache";
import { runMockChat } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 60; // Fluid Compute açıksa 300'e çıkarılabilir

async function authorized(): Promise<boolean> {
  const pass = process.env.APP_PASSWORD;
  if (!pass) return true; // parola tanımlı değilse açık (yerel geliştirme)
  const store = await cookies();
  const cookie = store.get("ictihat_auth")?.value ?? "";
  const a = Buffer.from(cookie);
  const b = Buffer.from(pass);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "ictihat_ara") {
    const mahkeme = (args.mahkeme as string) ?? "YARGITAY";
    const r = await search({
      ifade: String(args.ifade ?? ""),
      itemTypes: TUR_MAP[mahkeme] ?? TUR_MAP.YARGITAY,
      birim: (args.birim as string) ?? "ALL",
      baslangic: args.baslangic_tarihi as string | undefined,
      bitis: args.bitis_tarihi as string | undefined,
      sayfa: (args.sayfa as number) ?? 1,
    });
    return JSON.stringify(r);
  }
  if (name === "ictihat_getir") {
    const id = String(args.document_id ?? "");
    let markdown = await getCached(id);
    if (markdown == null) {
      markdown = (await getDocument(id)).markdown;
      await putCached(id, markdown);
    }
    // Aşırı uzun metni sınırla (LLM bağlamı için)
    return markdown.slice(0, 14000);
  }
  return `Bilinmeyen araç: ${name}`;
}

type ErrorCode = "rate_limit" | "general";

function errorCodeFor(message: string): ErrorCode {
  return message.includes("rate_limit") ? "rate_limit" : "general";
}

function emitSourcesFromAraResult(send: (obj: unknown) => void, result: string): void {
  // ictihat_ara başarıyla döndüyse sonuç JSON; kararlar dizisini UI'a ilet.
  try {
    const parsed = JSON.parse(result) as { kararlar?: KararOzet[] };
    const kararlar = parsed.kararlar ?? [];
    if (kararlar.length === 0) return;
    send({
      type: "sources",
      items: kararlar.map((k) => ({
        id: k.documentId,
        mahkeme: k.mahkeme,
        daire: k.daire,
        esasNo: k.esasNo,
        kararNo: k.kararNo,
        tarih: k.kararTarihi,
        title: null,
      })),
    });
  } catch {
    // ictihat_ara sonucu JSON değilse (örn. catch'li hata metni) sessizce geç
  }
}

export async function POST(req: Request) {
  if (!(await authorized())) {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
  }

  const url = new URL(req.url);
  const mockMode = url.searchParams.get("mock") === "1";

  let userMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  try {
    const body = await req.json();
    userMessages = body.messages ?? [];
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz istek" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      // Mock modu: gerçek LLM/tool döngüsüne girmeden sahte akış üret.
      if (mockMode) {
        try {
          await runMockChat(userMessages, send);
        } catch (e) {
          const msg = (e as Error).message;
          send({ type: "error", message: msg, code: errorCodeFor(msg) });
        } finally {
          controller.close();
        }
        return;
      }

      // Gerçek mod: LLM istemcisini burada kur (mock'ta gereksiz ve hata fırlatır)
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...userMessages,
      ];

      try {
        const { client, model } = getClient();
        for (let turn = 0; turn < 12; turn++) {
          const resp = await client.chat.completions.create({
            model,
            messages,
            tools: TOOLS,
            max_tokens: 4096,
          });
          const msg = resp.choices[0].message;
          messages.push(msg as OpenAI.Chat.Completions.ChatCompletionMessageParam);

          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            send({ type: "text", content: msg.content ?? "" });
            send({ type: "done" });
            controller.close();
            return;
          }

          const total = msg.tool_calls.length;
          for (let idx = 0; idx < msg.tool_calls.length; idx++) {
            const tc = msg.tool_calls[idx];
            // tool çağrısı başlamadan önce progress event'i
            send({
              type: "progress",
              current: idx + 1,
              total,
              label: "karar doğrulandı",
            });

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              /* boş bırak */
            }
            send({ type: "tool", name: tc.function.name, args });
            let result: string;
            try {
              result = await runTool(tc.function.name, args);
            } catch (e) {
              const errMsg = (e as Error).message;
              result = `Araç hatası: ${errMsg}`;
              // Tool hatasını UI'a da bildir (rate_limit kodlu ayrım için)
              send({ type: "error", message: errMsg, code: errorCodeFor(errMsg) });
            }
            // ictihat_ara başarılıysa, karar listesini UI'a gönder
            if (tc.function.name === "ictihat_ara") {
              emitSourcesFromAraResult(send, result);
            }
            messages.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
        }
        send({ type: "text", content: "Araç limiti aşıldı, soruyu daraltın." });
        send({ type: "done" });
      } catch (e) {
        const errMsg = (e as Error).message;
        send({ type: "error", message: errMsg, code: errorCodeFor(errMsg) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
