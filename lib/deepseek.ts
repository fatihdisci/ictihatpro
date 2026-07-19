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

type CompletionOptions = {
  messages: DeepSeekMessage[];
  tools?: DeepSeekTool[];
  toolChoice?: DeepSeekToolChoice;
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
};

export async function complete(options: CompletionOptions): Promise<DeepSeekMessage> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY tanımlı değil");

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
  // DeepSeek rejects a forced function selection while thinking is enabled.
  // The first research turn deliberately forces the Bedesten search; subsequent
  // turns return to automatic tool selection with thinking enabled.
  const forcedTool = options.toolChoice != null && options.toolChoice !== "auto";
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 5000,
    thinking: { type: forcedTool ? "disabled" : "enabled" },
    reasoning_effort: "medium",
  };
  if (options.tools) {
    body.tools = options.tools;
    // `auto` is the provider default. Omitting it preserves tool calling while
    // avoiding DeepSeek's thinking-mode/tool_choice incompatibility.
    if (options.toolChoice && options.toolChoice !== "auto") body.tool_choice = options.toolChoice;
  }
  if (options.json) body.response_format = { type: "json_object" };

  const timeout = AbortSignal.timeout(240_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`DeepSeek hatası: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: DeepSeekMessage }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("DeepSeek boş yanıt verdi");
  return message;
}
