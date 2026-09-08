export const MODEL_OPTIONS = [
  { id: "gpt-6-astra", label: "GPT-6 Astra", provider: "openai", description: "En güçlü; karmaşık hukukî sentez" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", provider: "openai", description: "Profesyonel işler için amiral gemisi" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "openai", description: "Kalite ve maliyet dengesi" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "openai", description: "Hızlı ve ekonomik" },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", description: "Güçlü önceki nesil seçenek" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "deepseek", description: "Mevcut güçlü varsayılan" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "deepseek", description: "Hızlı DeepSeek seçeneği" },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]["id"];

export function isSupportedModel(value: string): value is ModelId {
  return MODEL_OPTIONS.some((model) => model.id === value);
}

export function defaultModel(): ModelId {
  const configured = process.env.OPENAI_API_KEY ? process.env.OPENAI_MODEL : undefined;
  return configured && isSupportedModel(configured)
    ? configured
    : process.env.OPENAI_API_KEY
      ? "gpt-5.6-terra"
      : "deepseek-v4-pro";
}
