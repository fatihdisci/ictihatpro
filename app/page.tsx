"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { AnswerView } from "./_components/AnswerView";
import { Composer } from "./_components/Composer";
import { LoginGate } from "./_components/LoginGate";
import { ArrowUpRight, Moon, Sun } from "./_components/Icons";
import { circularThemeSwap, spring } from "./_lib/motion";
import { ALL_SOURCES, QUICK_SEARCHES, type Research, type ResearchSource } from "./_lib/types";

// Sıralı giriş için açık gecikmeli yükselme. Ebeveyn→çocuk variant yayılımına
// güvenmek yerine her öğe kendi initial/animate'ini taşır; HMR yeniden
// derlemeleri arasında bile tutarlı çalışır.
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring.glide, delay },
});

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [model, setModel] = useState("deepseek-v4-pro");
  const [question, setQuestion] = useState("");
  const [researches, setResearches] = useState<Research[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState("");
  const [progressCount, setProgressCount] = useState(0);
  const [error, setError] = useState<{ message: string; isRateLimit: boolean } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedSources, setSelectedSources] = useState<ResearchSource[]>(ALL_SOURCES);
  const endRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastQuestionRef = useRef("");
  const reduced = useReducedMotion();

  // Bir cevap geldiyse composer alta sabitlenir. İlk arama sırasında (busy ama
  // henüz cevap yok) hero görünür kalır ve durumu kendi iç composer'ında
  // gösterir; böylece ekranda tek composer bulunur.
  const docked = researches.length > 0;

  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Oturum bilgisi alınamadı");
        return response.json();
      })
      .then((data) => {
        setAuthenticated(Boolean(data.authenticated));
        setConfigured(Boolean(data.configured));
        setModel(data.model || "deepseek-v4-pro");
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!docked) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [researches, status, error, docked]);

  // layout.tsx'teki beforeInteractive betiği data-theme'i hidrasyondan önce
  // zaten uygular; burada yalnızca React durumunu o değerle senkronlarız.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  // Sabit composer'ın gerçek yüksekliğini --composer-h değişkenine yazar ki
  // shell alt boşluğu, çok satırlı sorularda içeriği kapatmasın. Yalnızca
  // sabit (docked) moddayken anlamlıdır.
  useEffect(() => {
    if (!authenticated || !docked) return;
    const el = dockRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`);
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [authenticated, docked]);

  // Textarea içeriğe göre büyür (CSS max-height ile sınırlı).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [question, docked]);

  function toggleTheme(event: React.MouseEvent) {
    const next = theme === "light" ? "dark" : "light";
    circularThemeSwap({ x: event.clientX, y: event.clientY }, () => {
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    }, Boolean(reduced));
    try {
      window.localStorage.setItem("ictihat-theme", next);
    } catch {
      // Gizli sekme gibi kısıtlı ortamlarda tema yine de bu oturumda uygulanır.
    }
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    setAuthenticated(false);
    setResearches([]);
  }

  async function runResearch(current: string) {
    setBusy(true);
    setError(null);
    setStatus("Araştırma hazırlanıyor");
    setDetail("");
    setProgressCount(0);
    lastQuestionRef.current = current;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: current, sources: selectedSources }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) setAuthenticated(false);
        setError({ message: data.error || `HTTP ${response.status}`, isRateLimit: response.status === 429 });
        setQuestion(current);
        return;
      }
      if (!response.body) throw new Error("Yanıt akışı açılamadı");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") {
            setStatus(event.message || "Araştırılıyor");
            setDetail(event.detail || "");
            if (event.message === "Karar metni doğrulanıyor" || event.message === "Ek karar sunucuda doğrulanıyor" || event.message === "Mevzuat metni açılıyor") {
              setProgressCount((count) => count + 1);
            }
          } else if (event.type === "warning") {
            setDetail(event.message || "");
          } else if (event.type === "answer") {
            setResearches((items) => [...items, { question: current, answer: event.answer }]);
            setStatus("");
            setDetail("");
          } else if (event.type === "error") {
            setError({
              message: event.message || "Araştırma tamamlanamadı",
              isRateLimit: event.code === "rate_limit_exceeded",
            });
            setQuestion(current);
            return;
          }
        }
      }
    } catch (caught) {
      setError({ message: caught instanceof Error ? caught.message : "Bilinmeyen hata", isRateLimit: false });
      setQuestion(current);
    } finally {
      setBusy(false);
      setStatus("");
      setDetail("");
    }
  }

  async function submit() {
    const current = question.trim();
    if (current.length < 5 || busy) return;
    setQuestion("");
    await runResearch(current);
  }

  function retry() {
    if (busy || !lastQuestionRef.current) return;
    runResearch(lastQuestionRef.current);
  }

  function toggleSource(source: ResearchSource) {
    setSelectedSources((current) => {
      if (current.includes(source)) return current.length === 1 ? current : current.filter((item) => item !== source);
      return [...current, source];
    });
  }

  if (authenticated === null) {
    return (
      <main className="boot" id="main-content">
        <span className="status-spin" aria-hidden="true" />
        <p>Güvenli oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (!authenticated) {
    return <LoginGate configured={configured} onAuthenticated={() => setAuthenticated(true)} />;
  }

  const canSend = question.trim().length >= 5 && !busy && selectedSources.length > 0;

  const composerProps = {
    textareaRef,
    dockRef,
    question,
    setQuestion,
    selectedSources,
    toggleSource,
    busy,
    canSend,
    submit,
    status,
    detail,
    progressCount,
  };

  return (
    <main className="shell" id="main-content" data-docked={docked}>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="wordmark" href="/" aria-label="İçtihat Asistanı">
            <span className="wordmark-glyph">İA</span>
            <span className="wordmark-text">
              <b>İçtihat Asistanı</b>
              <span>Hukuk araştırması</span>
            </span>
          </a>
          <div className="topbar-actions">
            <span className="chip-status">
              <i aria-hidden="true" />
              Kaynak kontrolü
            </span>
            <span className="model-name" title="Etkin model">{model}</span>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={spring.snap}
                  style={{ display: "grid", placeItems: "center" }}
                >
                  {theme === "dark" ? <Sun /> : <Moon />}
                </motion.span>
              </AnimatePresence>
            </button>
            <button className="link-btn" onClick={logout}>Çıkış</button>
          </div>
        </div>
        <motion.div
          className="topbar-line"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...spring.glide, delay: 0.1 }}
        />
      </header>

      <div className="wrap shell-body">
        {researches.length === 0 && (
          <section className="hero">
            <motion.span className="eyebrow" {...fadeUp(0.04)}>Araştırma · Bedesten</motion.span>
            <motion.h1 {...fadeUp(0.1)}>
              İçtihat ve mevzuatı <em>doğrulanmış</em> kaynaklarla araştırın.
            </motion.h1>
            <motion.p className="hero-lede" {...fadeUp(0.16)}>
              Uyuşmazlığı, aradığınız hukukî ölçütü veya karar bilgilerini yazın. Sonuçlar her zaman
              denetlenebilir kaynaklarıyla birlikte görünür.
            </motion.p>

            <motion.div className="hero-composer" {...fadeUp(0.22)}>
              <Composer docked={false} {...composerProps} />
            </motion.div>

            <motion.div className="presets" {...fadeUp(0.28)}>
              <div className="presets-head">
                <h2>Sık kullanılan aramalar</h2>
                <p>Bir kalıbı seçip ihtiyacınıza göre düzenleyin.</p>
              </div>
              <div className="preset-grid">
                {QUICK_SEARCHES.map((search, index) => (
                  <motion.button
                    key={search.label}
                    className="preset"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.glide, delay: 0.34 + index * 0.025 }}
                    onClick={() => {
                      setQuestion(search.query);
                      textareaRef.current?.focus();
                    }}
                    disabled={busy}
                    whileHover={reduced ? undefined : { y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <span className="preset-cat">{search.category}</span>
                    <span className="preset-label">{search.label}</span>
                    <ArrowUpRight className="preset-arrow" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        <LayoutGroup>
          {researches.map((research, index) => (
            <motion.div
              className="thread"
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="ask"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={spring.glide}
              >
                <span className="eyebrow">Soru</span>
                <p>{research.question}</p>
              </motion.div>
              <AnswerView answer={research.answer} />
            </motion.div>
          ))}
        </LayoutGroup>

        <AnimatePresence>
          {error && (
            <motion.div
              className={`alert${error.isRateLimit ? " alert-rate" : ""}`}
              role="alert"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.glide}
            >
              <strong>{error.isRateLimit ? "Çok sık istek gönderildi" : "Araştırma tamamlanamadı"}</strong>
              <span>{error.message}</span>
              <button onClick={retry} disabled={busy}>Tekrar dene</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {docked && <Composer docked {...composerProps} />}
    </main>
  );
}
