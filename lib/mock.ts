// lib/mock.ts
// ?mock=1 için sahte akış: progress + sources + text eventlerini sırayla üretir.
// Gerçek Bedesten / LLM çağrısı yapmaz; geliştirme ve UI smoke-test içindir.

import type { KararOzet } from "@/lib/bedesten";

export const mockSearchResult: { toplam: number; kararlar: KararOzet[] } = {
  toplam: 1,
  kararlar: [
    {
      documentId: "MOCK-DOC-001",
      mahkeme: "Yargıtay",
      daire: "9. Hukuk Dairesi",
      esasNo: "2023/1234",
      kararNo: "2024/567",
      kararTarihi: "2024-03-12",
      kesinlesme: null,
    },
  ],
};

export const mockAnswer =
  "Örnek cevap — gerçek API'ye geçince kaybolacak. [1] kaynağına bakın.";

/**
 * Mock akışı çalıştırır. `send` fonksiyonu her event için çağrılır
 * (route.ts içindeki NDJSON controller'ı sarmalayan aynı imza).
 * Eventler kısa setTimeout gecikmeleriyle gönderilir ki UI'da
 * "akıyor" hissi oluşsun.
 */
export async function runMockChat(
  _messages: unknown[],
  send: (obj: unknown) => void
): Promise<void> {
  // 1. araç: ictihat_ara
  send({
    type: "progress",
    current: 1,
    total: 2,
    label: "karar doğrulandı",
  });
  await sleep(250);
  send({
    type: "tool",
    name: "ictihat_ara",
    args: { ifade: "(mock) örnek arama" },
  });
  await sleep(350);
  send({
    type: "sources",
    items: [
      {
        id: mockSearchResult.kararlar[0].documentId,
        mahkeme: mockSearchResult.kararlar[0].mahkeme,
        daire: mockSearchResult.kararlar[0].daire,
        esasNo: mockSearchResult.kararlar[0].esasNo,
        kararNo: mockSearchResult.kararlar[0].kararNo,
        tarih: mockSearchResult.kararlar[0].kararTarihi,
        title: null,
      },
    ],
  });

  // 2. araç: ictihat_getir
  await sleep(400);
  send({
    type: "progress",
    current: 2,
    total: 2,
    label: "karar doğrulandı",
  });
  await sleep(250);
  send({
    type: "tool",
    name: "ictihat_getir",
    args: { document_id: mockSearchResult.kararlar[0].documentId },
  });
  await sleep(500);

  // Final cevap
  send({ type: "text", content: mockAnswer });
  send({ type: "done" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
