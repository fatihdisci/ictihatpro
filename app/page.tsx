"use client";

// İçtihat Asistanı — ana sayfa istemcisi.
// NDJSON tel şeması: progress / sources / answer (yeni) + text / tool / error / done (geriye uyumlu).

import { useCallback, useEffect, useRef, useState } from "react";
import { renderContent } from "./components/renderContent";
import { SourceCard } from "./components/SourceCard";
import { SourceStrip } from "./components/SourceStrip";
import { ProgressBar, RateCountdown } from "./components/ProgressBar";
import type { ErrorInfo, Msg, Source, Status, Theme } from "./components/types";

const ARAC_ETIKET: Record<string, string> = {
  ictihat_ara: "Kararlarda aranıyor",
  ictihat_getir: "Karar metni okunuyor",
};
const STORAGE_THEME = "ictihat-theme";
const COMPOSER_MAX_H = 200;

// ---------- Tema yardımcıları (yalnızca istemci) ----------

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_THEME);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* yoksay */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  try {
    window.localStorage.setItem(STORAGE_THEME, t);
  } catch {
    /* yoksay */
  }
}

// ---------- Bileşen ----------

export default function Home() {
  // Kimlik doğrulama
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState(false);

  // Sohbet durumu
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<ErrorInfo | null>(null);

  // UI
  const [theme, setTheme] = useState<Theme>("light");
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // Ref'ler
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ---- Efektler ----

  useEffect(() => {
    fetch("/api/login", { method: "POST", body: "{}" })
      .then((r) => r.json())
      .then((d) => setAuthed(d.note ? true : d.ok ? true : false))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    const t = readInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  // Composer yüksekliğini --composer-h değişkenine yaz → içerik kapatılmaz
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [authed]);

  // Textarea auto-grow
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, COMPOSER_MAX_H)}px`;
  }, [input]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, sources, error]);

  // Esc: error kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && error) setError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error]);

  // ---- Handlers ----

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyTheme(next);
      return next;
    });
  }, []);

  const toggleSource = useCallback((id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Citation tıklandığında: hedef kayda kaydır + body'yi aç. */
  const handleCite = useCallback((n: number) => {
    const id = `source-K${n}`;
    const el = document.getElementById(id);
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  /** Asistan mesaj içeriğini atıf rozetleriyle sarmala. */
  const renderAnswer = useCallback(
    (content: string) => renderContent(content, sources.length, handleCite),
    [sources.length, handleCite],
  );

  async function login() {
    setLoginErr(false);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setAuthed(r.ok);
      if (!r.ok) setLoginErr(true);
    } catch {
      setLoginErr(true);
    }
  }

  /** Asistan mesajını ya günceller (zaten en son eklenmişse) ya da yeni balon ekler. */
  const upsertAssistant = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last && last.role === "assistant"
        ? [...prev.slice(0, -1), { role: "assistant", content: text }]
        : [...prev, { role: "assistant", content: text }];
    });
  }, []);

  async function gonder() {
    const q = input.trim();
    if (!q || busy) return;

    setSources([]);
    setError(null);
    setExpandedSources(new Set());

    const yeni: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(yeni);
    setInput("");
    setBusy(true);
    setStatus({ name: "dusunuluyor" });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: yeni }),
      });
      if (!res.body) throw new Error("Yanıt gövdesi yok");
      if (!res.ok) {
        const isRate = res.status === 429;
        setError({
          kind: isRate ? "rate_limit" : "general",
          message: isRate
            ? "Çok sık istek gönderildi. Lütfen kısa bir süre sonra tekrar deneyin."
            : `Sunucu hatası (${res.status})`,
          retryAt: isRate ? Date.now() + 30_000 : undefined,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let hasAnswer = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const satirlar = buf.split("\n");
        buf = satirlar.pop() ?? "";
        for (const s of satirlar) {
          if (!s.trim()) continue;
          let ev: { type: string; [k: string]: unknown };
          try {
            ev = JSON.parse(s);
          } catch {
            continue;
          }
          switch (ev.type) {
            case "progress": {
              const p = ev as unknown as { current: number; total: number; label?: string };
              setStatus({
                name: "dusunuluyor",
                progress: { current: p.current, total: p.total, label: p.label },
              });
              break;
            }
            case "tool":
              setStatus({
                name: String(ev.name ?? ""),
                args: (ev.args as Record<string, unknown>) ?? undefined,
              });
              break;
            case "sources": {
              const items = (ev.items as Source[]) ?? [];
              setSources((prev) => [
                ...prev,
                ...items.map((it, i) => ({ ...it, id: `K${prev.length + i + 1}` })),
              ]);
              break;
            }
            case "answer":
            case "text":
              hasAnswer = true;
              setStatus(null);
              upsertAssistant(String(ev.content ?? ""));
              break;
            case "error": {
              const message = String(ev.message ?? "Bilinmeyen hata");
              const isRate = (ev.code as string) === "rate_limit";
              setError(
                isRate
                  ? { kind: "rate_limit", message, retryAt: Date.now() + 30_000 }
                  : { kind: "general", message },
              );
              break;
            }
            // done, diğer → yoksay
          }
        }
      }

      if (!hasAnswer) setStatus(null);
    } catch (e) {
      setError({ kind: "general", message: (e as Error).message });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  // ---- Türetilmiş ----

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const hasUser = messages.some((m) => m.role === "user");
  const showEmptyState =
    !busy &&
    status === null &&
    sources.length === 0 &&
    hasUser &&
    lastAssistant !== undefined &&
    lastAssistant.content.trim() === "";

  // ---- Render ----

  if (authed === null)
    return <main className="center"><span className="muted">Yükleniyor…</span></main>;

  if (!authed) {
    return (
      <main className="center">
        <div className="login" id="main-content">
          <h1 className="brand">İçtihat<span>·</span></h1>
          <p className="muted">Devam etmek için erişim parolasını girin.</p>
          <input
            type="password"
            className="pw"
            value={password}
            placeholder="Parola"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            autoFocus
            aria-label="Parola"
          />
          {loginErr && (
            <p className="err" role="alert">
              Parola hatalı.
            </p>
          )}
          <button className="btn" onClick={login}>
            Gir
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <span className="brand sm">İçtihat<span aria-hidden="true">·</span></span>
        <div className="topbar-right">
          <span className="muted tiny hint">Yargıtay · Danıştay · BAM · Yerel</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Karanlık temaya geç" : "Aydınlık temaya geç"}
            aria-pressed={theme === "dark"}
            title={theme === "light" ? "Karanlık tema" : "Aydınlık tema"}
          >{theme === "light" ? "☾" : "☀"}</button>
        </div>
      </header>

      <div className="thread" id="main-content" tabIndex={-1}>
        {error && (
          <div
            className={`error-card ${error.kind === "rate_limit" ? "is-rate" : ""}`}
            role="alert"
          >
            <div className="error-msg">
              <strong>
                {error.kind === "rate_limit" ? "Çok sık istek" : "Bir sorun oluştu"}
              </strong>
              <p>{error.message}</p>
              {error.kind === "rate_limit" && error.retryAt && (
                <RateCountdown retryAt={error.retryAt} onRetry={gonder} busy={busy} />
              )}
            </div>
            <div className="error-actions">
              <button type="button" className="btn" onClick={() => setError(null)}>Kapat</button>
              <button
                type="button"
                className="btn"
                onClick={() => { setError(null); gonder(); }}
              >Tekrar dene</button>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="empty">
            <h2 className="welcome">Hoş geldiniz</h2>
            <p>Bir hukuki soru sorun. Kararlar Bedesten üzerinden aranıp okunur.</p>
            <p className="muted tiny">
              Örn: “SGK çıkış kodu 26 ile fesihte işe iade davasında son Yargıtay 9. HD
              kararları ne yönde?”
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={`m-${i}`} className="bubble user">
                <div className="who">Sen</div>
                <div className="body">{m.content}</div>
              </div>
            );
          }
          const isLast = i === messages.length - 1;
          return (
            <article key={`m-${i}`} className="answer-card">
              <header className="answer-head">
                <span className="who">Asistan</span>
                {isLast && sources.length > 0 && (
                  <span className="badge muted tiny">Kaynaklar ({sources.length})</span>
                )}
              </header>
              <div className="body">{renderAnswer(m.content)}</div>
              {isLast && sources.length > 0 && <SourceStrip sources={sources} onCite={handleCite} />}
            </article>
          );
        })}

        {(status || (busy && sources.length === 0 && !error)) && (
          <div className="status" aria-live="polite" aria-busy="true">
            <span className="spinner" aria-hidden />
            <span className="status-text">
              {status?.progress
                ? `${status.progress.label ?? "İlerleniyor"} (${status.progress.current}/${status.progress.total || "?"})`
                : status?.name && status.name !== "dusunuluyor"
                ? ARAC_ETIKET[status.name] ?? status.name
                : "Düşünüyor…"}
              {status?.args?.ifade ? <em> — “{String(status.args.ifade)}”</em> : null}
            </span>
          </div>
        )}

        {status?.progress && sources.length > 0 && (
          <ProgressBar progress={status.progress} sourceCount={sources.length} />
        )}

        {sources.length > 0 && (
          <section className="sources" aria-label="Kaynak kararlar">
            {sources.map((src, i) => (
              <SourceCard
                key={src.id}
                index={i + 1}
                source={src}
                expanded={expandedSources.has(src.id)}
                onToggle={() => toggleSource(src.id)}
              />
            ))}
          </section>
        )}

        {showEmptyState && (
          <div className="empty-card" role="status">
            <strong>Doğrulanabilir karar bulunamadı</strong>
            <p>Şunları deneyebilirsiniz:</p>
            <ul className="empty-tips">
              <li>İfadeyi değiştirin veya daha kısa yazın</li>
              <li>Daireyi daraltın (örn. yalnız 9. HD)</li>
              <li>Tarih aralığı ekleyin</li>
            </ul>
            <button type="button" className="btn" onClick={() => taRef.current?.focus()}>
              Yeniden dene
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="composer" ref={composerRef}>
        <textarea
          ref={taRef}
          value={input}
          placeholder="Sorunuzu yazın…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              gonder();
            }
          }}
          rows={1}
          aria-label="Mesajınız"
          disabled={busy}
        />
        <button
          type="button"
          className="btn send"
          onClick={gonder}
          disabled={busy || !input.trim()}
        >{busy ? "…" : "Gönder"}</button>
      </div>
    </main>
  );
}
