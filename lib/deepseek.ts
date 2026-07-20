export type DeepSeekMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
  reasoning_content?: string | null;
};

export type DeepSeekToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type DeepSeekTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type DeepSeekToolChoice =
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };

/**
 * `pro` kullanıcıya görünen tek çıktı olan sentez için; `fast` ise dar şemalı,
 * tek doğru cevabı olan yardımcı çağrılar (arama planı, yeniden sıralama)
 * içindir. Flash yapılandırılmış görevlerde Pro'nun 1-2 puan gerisinde ama
 * belirgin biçimde ucuz ve yüksek eşzamanlılıklıdır; bu çağrılar Bedesten
 * kotasını beklettiği için düşük gecikme ayrıca kazançtır.
 */
export type DeepSeekTier = "pro" | "fast";

type CompletionOptions = {
  messages: DeepSeekMessage[];
  tools?: DeepSeekTool[];
  toolChoice?: DeepSeekToolChoice;
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
  tier?: DeepSeekTier;
  /** Belirtilmezse araçlı çağrılarda kapalı, araçsız çağrılarda açıktır. */
  reasoning?: boolean;
};

function resolveModel(tier: DeepSeekTier): string {
  return tier === "fast"
    ? process.env.DEEPSEEK_MODEL_FAST ?? "deepseek-v4-flash"
    : process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
}

// Sağlayıcı thinking ile zorunlu araç seçimini birlikte kabul etmiyor. İstek
// gövdesi buna göre kurulur; yine de reddedilirse thinking kapatılıp bir kez
// daha denenir.
const REASONING_CONFLICT = /think|reason|tool_choice/i;

function buildBody(options: CompletionOptions, model: string, reasoning: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 5000,
    thinking: { type: reasoning ? "enabled" : "disabled" },
    reasoning_effort: "medium",
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    // `auto` zaten sağlayıcı varsayılanı olduğu için gönderilmez. Thinking
    // açıkken zorunlu araç seçimi de gönderilemez; bu durumda araç çağrısı
    // modele bırakılır, çağırmazsa çağıran taraf JSON onarımına düşer.
    const forced = options.toolChoice && options.toolChoice !== "auto";
    if (forced && !reasoning) body.tool_choice = options.toolChoice;
  }
  if (options.json) body.response_format = { type: "json_object" };
  return body;
}

export async function complete(options: CompletionOptions): Promise<DeepSeekMessage> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY tanımlı değil");

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = resolveModel(options.tier ?? "pro");
  const reasoning = options.reasoning ?? !options.tools?.length;

  const timeout = AbortSignal.timeout(240_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  const send = (useReasoning: boolean) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(options, model, useReasoning)),
      signal,
      cache: "no-store",
    });

  let response = await send(reasoning);
  if (!response.ok) {
    let detail = (await response.text()).slice(0, 1000);
    // Sağlayıcı thinking'i bu istekle bağdaştıramıyorsa araştırma tamamen
    // başarısız olmasın: aynı istek reasoning kapatılarak yinelenir.
    if (response.status === 400 && reasoning && REASONING_CONFLICT.test(detail)) {
      response = await send(false);
      if (!response.ok) detail = (await response.text()).slice(0, 1000);
    }
    if (!response.ok) {
      throw new Error(`DeepSeek hatası: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
    }
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: DeepSeekMessage }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("DeepSeek boş yanıt verdi");
  return message;
}
