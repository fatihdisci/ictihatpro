// lib/llm.ts
// Sağlayıcı yapılandırması (DeepSeek / OpenAI / LiteLLM) ve araç şemaları.

import OpenAI from "openai";

const PROVIDERS: Record<string, { baseURL: string; keyEnv: string; model: string }> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    keyEnv: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    model: "gpt-4o",
  },
  litellm: {
    baseURL: process.env.LITELLM_BASE_URL ?? "http://localhost:4000",
    keyEnv: "LITELLM_API_KEY",
    model: "deepseek-chat",
  },
};

export function getClient(): { client: OpenAI; model: string } {
  const name = (process.env.LLM_PROVIDER ?? "deepseek").toLowerCase();
  const cfg = PROVIDERS[name];
  if (!cfg) throw new Error(`Bilinmeyen LLM_PROVIDER: ${name}`);
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) throw new Error(`${cfg.keyEnv} ortam değişkeni tanımlı değil`);
  const client = new OpenAI({ apiKey, baseURL: cfg.baseURL });
  const model = process.env.LLM_MODEL ?? cfg.model;
  return { client, model };
}

export const SYSTEM_PROMPT = `Sen İzmir'de çalışan bir avukatın kişisel içtihat asistanısın.
Elindeki araçlarla Yargıtay, Danıştay, yerel mahkeme ve BAM kararlarında arama
yapabilir ve karar metinlerini okuyabilirsin.

Kurallar:
- Önce ictihat_ara ile ara, ilgili kararların tam metnini ictihat_getir ile oku,
  SONRA cevap ver. Sadece başlık üzerinden hüküm çıkarma.
- Her karara atıf yaparken daire, esas no, karar no ve tarihi belirt
  (örn. Yargıtay 9. HD, 2023/1234 E., 2024/567 K., 12.03.2024).
- İçtihat metnini olduğu gibi aktarma; ilgili kısmı özetle.
- Bulamadığın şeyi uydurma; bulamadığını açıkça söyle.
- Cevapların Türkçe, net ve bir meslektaşa yazar gibi olsun.
- Bu araştırmalar hukuki dayanak taslağıdır; nihai değerlendirme avukata aittir.`;

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "ictihat_ara",
      description:
        "Türk mahkeme kararlarında arama yapar. Yargıtay, Danıştay, yerel hukuk, istinaf, KYB.",
      parameters: {
        type: "object",
        properties: {
          ifade: {
            type: "string",
            description:
              'Arama ifadesi. Operatörler: "tam ifade", +zorunlu, -hariç, AND/OR/NOT.',
          },
          mahkeme: {
            type: "string",
            enum: ["YARGITAY", "DANISTAY", "YEREL", "ISTINAF", "KYB", "HEPSI"],
            description: "Mahkeme türü. Varsayılan YARGITAY.",
          },
          birim: {
            type: "string",
            description:
              "Daire filtresi. Yargıtay: H1-H23, C1-C23, HGK, CGK. Danıştay: D1-D17, IDDK, VDDK. Varsayılan ALL.",
          },
          baslangic_tarihi: { type: "string", description: "YYYY-AA-GG" },
          bitis_tarihi: { type: "string", description: "YYYY-AA-GG" },
          sayfa: { type: "number", description: "Sonuç sayfası (10'arlı)." },
        },
        required: ["ifade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ictihat_getir",
      description: "Bir kararın tam metnini Markdown olarak getirir.",
      parameters: {
        type: "object",
        properties: {
          document_id: {
            type: "string",
            description: "ictihat_ara sonucundaki documentId.",
          },
        },
        required: ["document_id"],
      },
    },
  },
];

export const TUR_MAP: Record<string, string[]> = {
  YARGITAY: ["YARGITAYKARARI"],
  DANISTAY: ["DANISTAYKARAR"],
  YEREL: ["YERELHUKUK"],
  ISTINAF: ["ISTINAFHUKUK"],
  KYB: ["KYB"],
  HEPSI: ["YARGITAYKARARI", "DANISTAYKARAR", "YERELHUKUK", "ISTINAFHUKUK", "KYB"],
};
