"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DecisionSource = {
  kind: "decision";
  id: string;
  documentId: string;
  court: string | null;
  chamber: string | null;
  esasNo: string | null;
  kararNo: string | null;
  date: string | null;
  sourceUrl: string;
  evidenceComplete: boolean;
  excerpt: string;
};

type LegislationSource = {
  kind: "legislation";
  id: string;
  legislationId: string;
  number: string | null;
  name: string;
  type: string | null;
  series: string | null;
  officialGazetteDate: string | null;
  officialGazetteNumber: string | null;
  sourceUrl: string;
  evidenceComplete: boolean;
  excerpt: string;
};

type Source = DecisionSource | LegislationSource;
type ResearchSource = "YARGITAY" | "ISTINAF" | "DANISTAY" | "YEREL" | "KYB" | "MEVZUAT";

const SOURCE_OPTIONS: Array<{ id: ResearchSource; label: string; shortLabel: string }> = [
  { id: "YARGITAY", label: "Yargıtay kararları", shortLabel: "Yargıtay" },
  { id: "ISTINAF", label: "BAM hukuk kararları", shortLabel: "İstinaf" },
  { id: "DANISTAY", label: "Danıştay kararları", shortLabel: "Danıştay" },
  { id: "YEREL", label: "Yerel hukuk mahkemesi kararları", shortLabel: "Yerel" },
  { id: "KYB", label: "Kanun yararına bozma kararları", shortLabel: "KYB" },
  { id: "MEVZUAT", label: "Resmî mevzuat", shortLabel: "Mevzuat" },
];

type Answer = {
  mode?: "analysis" | "sources";
  title: string;
  summary: string;
  summarySourceIds: string[];
  sections: Array<{ heading: string; text: string; sourceIds: string[] }>;
  limitations: string[];
  sources: Source[];
};

type Research = { question: string; answer: Answer };

const QUICK_SEARCHES = [
  { category: "İş", label: "İşe iade · geçerli fesih", query: "İşe iade davasında geçerli fesih ve ispat yükü hangi ölçütlerle değerlendirilir?" },
  { category: "İş", label: "Kıdem ve ihbar tazminatı", query: "Kıdem ve ihbar tazminatında ücretin tespiti, faiz ve zamanaşımı nasıl uygulanır?" },
  { category: "İş", label: "Fazla çalışma alacağı", query: "Fazla çalışma alacağında ispat, tanık beyanı ve hesaplama nasıl değerlendirilir?" },
  { category: "Kira", label: "İhtiyaç nedeniyle tahliye", query: "Konut ihtiyacı nedeniyle tahliye davasının şartları ve ispatı nasıl değerlendirilir?" },
  { category: "Kira", label: "Kira tespit davası", query: "Kira tespit davasında emsal kira bedeli ve hakkaniyet indirimi nasıl belirlenir?" },
  { category: "Aile", label: "Boşanma · kusur ve tazminat", query: "Boşanma davasında kusur belirlemesi ile maddi ve manevi tazminat koşulları nasıl değerlendirilir?" },
  { category: "Aile", label: "Velayetin değiştirilmesi", query: "Velayetin değiştirilmesi davasında çocuğun üstün yararı hangi ölçütlerle değerlendirilir?" },
  { category: "Aile", label: "Yoksulluk nafakası", query: "Yoksulluk nafakasının artırılması veya kaldırılmasında hangi ölçütler dikkate alınır?" },
  { category: "İcra", label: "İtirazın iptali", query: "İtirazın iptali davasında icra inkâr tazminatının şartları nelerdir?" },
  { category: "Tazminat", label: "Trafik kazası · değer kaybı", query: "Trafik kazası nedeniyle araç değer kaybı tazminatında hesaplama ve ispat nasıl yapılır?" },
  { category: "Ticaret", label: "Ayıplı mal ve ayıp ihbarı", query: "Tacirler arası satımda ayıp ihbarının süresi ve şekli nasıl değerlendirilir?" },
  { category: "Taşınmaz", label: "Ortaklığın giderilmesi", query: "Ortaklığın giderilmesi davasında aynen taksim ve satış koşulları nasıl değerlendirilir?" },
] as const;

function CitationBadges({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="citations" aria-label="Bu bölümün kaynakları">
      {ids.map((id) => (
        <a key={id} href={`#source-${id}`} className="citation" aria-label={`Kaynak ${id}'e git`}>{id}</a>
      ))}
    </span>
  );
}

function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}

type DecisionText =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; mimeType: string };

function SourceCard({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionText | null>(null);
  const [copied, setCopied] = useState(false);

  async function toggleText() {
    if (source.kind !== "decision") return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (decision?.status === "ready" || decision?.status === "loading") return;
    setDecision({ status: "loading" });
    try {
      const response = await fetch(`/api/decision?id=${encodeURIComponent(source.documentId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setDecision({ status: "ready", text: data.text, mimeType: data.mimeType });
    } catch (caught) {
      setDecision({ status: "error", message: caught instanceof Error ? caught.message : "Karar metni alınamadı" });
    }
  }

  async function copyText() {
    if (decision?.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(decision.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessizce geç; düğme metni değişmeyerek zaten geri bildirim verir.
    }
  }

  return (
    <article className="source" id={`source-${source.id}`}>
      <div className="source-id">{source.id}</div>
      <div className="source-main">
        {source.kind === "decision" ? <>
          <strong>{[source.court, source.chamber].filter(Boolean).join(" · ") || "Mahkeme bilgisi yok"}</strong>
          <div className="source-meta">
            <span>{source.esasNo ? `${source.esasNo} E.` : "Esas no doğrulanamadı"}</span>
            <span>{source.kararNo ? `${source.kararNo} K.` : "Karar no doğrulanamadı"}</span>
            <span>{source.date ?? "Tarih verisi doğrulanamadı"}</span>
          </div>
          <div className="source-foot">
            <span>Bedesten belge no: {source.documentId}</span>
            {!source.evidenceComplete && <span className="partial">Seçili pasajlar incelendi</span>}
          </div>
        </> : <>
          <strong>{source.name}</strong>
          <div className="source-meta">
            <span>{source.number ? `${source.number} sayılı` : "Numara bilgisi yok"}</span>
            <span>{source.type ?? "Mevzuat"}</span>
            <span>{source.officialGazetteDate ?? "Resmî Gazete tarihi yok"}</span>
          </div>
          <div className="source-foot">
            {source.officialGazetteNumber && <span>RG: {source.officialGazetteNumber}</span>}
            {!source.evidenceComplete && <span className="partial">İlgili bölüm incelendi</span>}
          </div>
        </>}
        <div className="source-excerpt">
          <div className="source-excerpt-label">İlgili bölüm</div>
          <Markdown>{source.excerpt}</Markdown>
        </div>
        {source.kind === "decision" && open && (
          <div className="decision-text" aria-live="polite">
            {decision?.status === "ready" && (
              <div className="decision-head">
                <button className="decision-copy" onClick={copyText}>{copied ? "Kopyalandı" : "Metni kopyala"}</button>
              </div>
            )}
            {(!decision || decision.status === "loading") && <p className="decision-wait">Karar metni yükleniyor…</p>}
            {decision?.status === "error" && <p className="decision-error">{decision.message}</p>}
            {decision?.status === "ready" &&
              (decision.mimeType.includes("pdf") ? (
                <pre>{decision.text}</pre>
              ) : (
                <Markdown>{decision.text}</Markdown>
              ))}
          </div>
        )}
      </div>
      <div className="source-actions">
        {source.kind === "decision" && <button className="official-link as-button" onClick={toggleText} aria-expanded={open}>
          {open ? "Metni gizle" : "Tam metin"}
        </button>}
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="official-link">
          {source.kind === "decision" ? "Resmî sistem" : "Resmî metin"}
        </a>
      </div>
    </article>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  const isEmpty = answer.sources.length === 0;
  if (answer.mode === "sources") {
    return (
      <article className={`answer-card source-results${isEmpty ? " is-empty" : ""}`}>
        <div className="source-results-heading">
          <div>
            <div className="answer-kicker">Arama sonucu</div>
            <h2>Bulunan kaynaklar</h2>
          </div>
          <span>{answer.sources.length} kaynak</span>
        </div>
        {isEmpty ? <p>Seçilen kapsamda ilgili bir kaynak bulunamadı.</p> : (
          <div className="source-list">
            {answer.sources.map((source) => <SourceCard source={source} key={`${source.kind}-${source.id}`} />)}
          </div>
        )}
      </article>
    );
  }
  return (
    <article className={`answer-card${isEmpty ? " is-empty" : ""}`}>
      <div className="answer-kicker">Doğrulanmış araştırma özeti</div>
      <h2>{answer.title}</h2>
      <section className="summary">
        <Markdown>{answer.summary}</Markdown>
        <CitationBadges ids={answer.summarySourceIds} />
      </section>

      {answer.sections.map((section, index) => (
        <section className="answer-section" key={`${section.heading}-${index}`}>
          <h3>{section.heading}</h3>
          <Markdown>{section.text}</Markdown>
          <CitationBadges ids={section.sourceIds} />
        </section>
      ))}

      {answer.limitations.length > 0 && (
        <aside className="limitations">
          <h3>Sınırlar ve kontrol notları</h3>
          <ul>{answer.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </aside>
      )}

      {answer.sources.length > 0 && (
        <section className="sources">
          <div className="sources-heading">
            <h3>Doğrulanmış kararlar</h3>
            <span>{answer.sources.length} kaynak</span>
          </div>
          <div className="source-list">
            {answer.sources.map((source) => (
              <SourceCard source={source} key={source.id} />
            ))}
          </div>
        </section>
      )}

      <p className="legal-note">Bu çıktı kaynak kontrollü bir araştırma taslağıdır; dosya özelinde nihai hukukî değerlendirme yerine geçmez.</p>
    </article>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [model, setModel] = useState("deepseek-v4-pro");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [question, setQuestion] = useState("");
  const [researches, setResearches] = useState<Research[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState("");
  const [progressCount, setProgressCount] = useState(0);
  const [error, setError] = useState<{ message: string; isRateLimit: boolean } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selectedSources, setSelectedSources] = useState<ResearchSource[]>(["YARGITAY", "ISTINAF", "DANISTAY", "YEREL", "KYB", "MEVZUAT"]);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef("");

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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [researches, status, error]);

  // layout.tsx'teki beforeInteractive betiği data-theme'i hidrasyondan önce
  // zaten uygular; burada yalnızca React durumunu o değerle senkronlarız.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  // Composer'ın gerçek yüksekliğini --composer-h değişkenine yazar ki
  // app-shell alt boşluğu, çok satırlı sorularda içeriği kapatmasın.
  useEffect(() => {
    if (!authenticated) return;
    const el = composerRef.current;
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
  }, [authenticated]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("ictihat-theme", next);
    } catch {
      // Gizli sekme gibi kısıtlı ortamlarda tema yine de bu oturumda uygulanır.
    }
  }

  async function login() {
    setLoginError("");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setPassword("");
      setAuthenticated(true);
    } else {
      setLoginError(data.error || "Giriş yapılamadı");
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
            throw new Error(event.message || "Araştırma tamamlanamadı");
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
    return <main className="center"><div className="loader" /><p>Güvenli oturum kontrol ediliyor…</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="login-shell" id="main-content">
        <div className="login-ambient" aria-hidden="true" />
        <section className="login-panel">
          <div className="login-panel-topline"><span>İÇTİHAT ASİSTANI</span><span>OTURUM</span></div>
          <div className="seal">İA</div>
          <div className="eyebrow">Giriş</div>
          <h1>İçtihat Asistanı</h1>
          <p>Devam etmek için parolanızı girin.</p>
          {!configured && <div className="config-warning">Sunucu yapılandırması eksik. APP_PASSWORD ve SESSION_SECRET değerlerini ekleyin.</div>}
          <label htmlFor="password">Erişim parolası</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && login()}
            autoComplete="current-password"
            autoFocus
          />
          {loginError && <p className="form-error" role="alert">{loginError}</p>}
          <button className="primary" onClick={login} disabled={!password}>Giriş yap <span aria-hidden="true">↗</span></button>
          <div className="login-foot"><span className="dot" /> API anahtarı tarayıcıya gönderilmez</div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" id="main-content">
      <header className="topbar">
        <div className="identity">
          <div className="seal small">İA</div>
          <div><strong>İçtihat Asistanı</strong><span>Araştırma</span></div>
        </div>
        <div className="top-actions">
          <span className="model-badge"><i /> Kaynak kontrolü</span>
          <span className="model-name">{model}</span>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="text-button" onClick={logout}>Çıkış</button>
        </div>
      </header>

      <div className="content">
        {researches.length === 0 && (
          <section className="welcome">
            <div className="welcome-grid">
              <div className="welcome-copy">
                <div className="welcome-overline"><span>ARAŞTIRMA</span><span>BEDesten</span></div>
                <h1>İçtihat araştırması</h1>
                <p>Uyuşmazlığı, aradığınız hukukî ölçütü veya karar bilgilerini yazın. Sonuçlar kaynaklarıyla birlikte burada görünür.</p>
              </div>
            </div>
            <section className="quick-searches" aria-label="Hazır arama kalıpları">
              <div className="quick-searches-heading">
                <div><span>HAZIR ARAMALAR</span><h2>Sık kullanılanlar</h2></div>
                <p>Bir kalıp seçip ihtiyacınıza göre düzenleyin.</p>
              </div>
              <div className="quick-search-grid">
                {QUICK_SEARCHES.map((search) => (
                  <button key={search.label} onClick={() => setQuestion(search.query)} disabled={busy}>
                    <span>{search.category}</span>
                    <strong>{search.label}</strong>
                    <b aria-hidden="true">↗</b>
                  </button>
                ))}
              </div>
            </section>
          </section>
        )}

        {researches.map((research, index) => (
          <div className="research" key={index}>
            <div className="question-card"><span>Soru</span><p>{research.question}</p></div>
            <AnswerView answer={research.answer} />
          </div>
        ))}

        {error && (
          <div className={`request-error${error.isRateLimit ? " is-rate-limit" : ""}`} role="alert">
            <strong>{error.isRateLimit ? "Çok sık istek gönderildi" : "Araştırma tamamlanamadı"}</strong>
            <span>{error.message}</span>
            <button className="retry-button" onClick={retry} disabled={busy}>Tekrar dene</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap" ref={composerRef}>
        {busy && (
          <section className="progress searching-panel" aria-live="polite">
            <div className="progress-line"><div /></div>
            <div>
              <strong>
                {progressCount > 0 && <span className="progress-count">{progressCount}</span>}
                {status || "Araştırılıyor"}
              </strong>
              <span>{detail || "Seçilen kaynaklar taranıyor; bu alan araştırma boyunca görünür kalır."}</span>
            </div>
          </section>
        )}
        <div className="composer">
          <div className="composer-field">
            <div className="composer-label-row">
              <label htmlFor="research-question">Yeni araştırma</label>
              <div className="source-picker" aria-label="Aranacak kaynaklar">
                {SOURCE_OPTIONS.map((source) => {
                  const selected = selectedSources.includes(source.id);
                  return <button
                    key={source.id}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    onClick={() => toggleSource(source.id)}
                    aria-pressed={selected}
                    title={source.label}
                    disabled={busy || (selected && selectedSources.length === 1)}
                  >{source.shortLabel}</button>;
                })}
              </div>
            </div>
            <textarea
              id="research-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Uyuşmazlığı, aradığınız hukuki ölçütü ve varsa mahkeme/daireyi yazın…"
              rows={2}
              maxLength={6000}
              disabled={busy}
            />
          </div>
          <button className="send" onClick={submit} disabled={busy || question.trim().length < 5 || selectedSources.length === 0} aria-label="Araştırmayı başlat">
            <span>{busy ? "Araştırılıyor" : "Araştır"}</span><b aria-hidden="true">↗</b>
          </button>
        </div>
        <p><kbd>↵</kbd> araştır &nbsp; <span>·</span> &nbsp; Her soru bağımsız araştırılır; olay türü, hukukî sorun ve tarih aralığını açıkça yazın.</p>
      </div>
    </main>
  );
}
