// Paylaşılan tipler — istemci tarafı bileşenler için.

export type Msg = { role: "user" | "assistant"; content: string };

export type Progress = { current: number; total: number; label?: string };

export type Status = {
  name: string;
  args?: Record<string, unknown>;
  progress?: Progress;
} | null;

export type Source = {
  /** Görüntüleme sırasında K1, K2 ... gibi yeniden etiketlenir. */
  id: string;
  mahkeme?: string;
  daire?: string;
  esasNo?: string;
  kararNo?: string;
  tarih?: string;
  title?: string;
  summary?: string;
  fullText?: string;
  contradictory?: boolean;
};

export type ErrorInfo = {
  kind: "general" | "rate_limit";
  message: string;
  /** epoch ms — geri sayım için (rate limit). */
  retryAt?: number;
};

export type Theme = "light" | "dark";
