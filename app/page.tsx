"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = {
  id: string;
  documentId: string;
  court: string | null;
  chamber: string | null;
  esasNo: string | null;
  kararNo: string | null;
  date: string | null;
  sourceUrl: string;
  evidenceComplete: boolean;
};

type Answer = {
  title: string;
  summary: string;
  summarySourceIds: string[];
  sections: Array<{ heading: string; text: string; sourceIds: string[] }>;
  limitations: string[];
  sources: Source[];
};

type Research = { question: string; answer: Answer };

function CitationBadges({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="citations" aria-label="Bu bölümün kaynakları">
      {ids.map((id) => (
        <a key={id} href={`#source-${id}`} className="citation">{id}</a>
      ))}
    </span>
  );
}

function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}

function AnswerView({ answer }: { answer: Answer }) {
  return (
    <article className="answer-card">
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
              <article className="source" id={`source-${source.id}`} key={source.id}>
                <div className="source-id">{source.id}</div>
                <div className="source-main">
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
                </div>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="official-link">
                  Resmî sistem
                </a>
              </article>
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
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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

  async function submit() {
    const current = question.trim();
    if (current.length < 5 || busy) return;
    setBusy(true);
    setError("");
    setStatus("Araştırma hazırlanıyor");
    setDetail("");
    setQuestion("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: current }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) setAuthenticated(false);
        throw new Error(data.error || `HTTP ${response.status}`);
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
      setError(caught instanceof Error ? caught.message : "Bilinmeyen hata");
      setQuestion(current);
    } finally {
      setBusy(false);
      setStatus("");
      setDetail("");
    }
  }

  if (authenticated === null) {
    return <main className="center"><div className="loader" /><p>Güvenli oturum kontrol ediliyor…</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="seal">İA</div>
          <div className="eyebrow">Kişisel hukuk araştırma alanı</div>
          <h1>İçtihat Asistanı</h1>
          <p>Yalnızca doğrulanan Bedesten kararlarına bağlı, kaynak kontrollü araştırma.</p>
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
          <button className="primary" onClick={login} disabled={!password}>Güvenli giriş</button>
          <div className="login-foot"><span className="dot" /> API anahtarı tarayıcıya gönderilmez</div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="identity">
          <div className="seal small">İA</div>
          <div><strong>İçtihat Asistanı</strong><span>Kaynak kontrollü araştırma</span></div>
        </div>
        <div className="top-actions">
          <span className="model-badge">{model}</span>
          <button className="text-button" onClick={logout}>Çıkış</button>
        </div>
      </header>

      <div className="content">
        {researches.length === 0 && (
          <section className="welcome">
            <div className="welcome-mark">§</div>
            <h1>Kararı değil, dayanağını bulun.</h1>
            <p>Asistan önce Bedesten’de arar, kararın tam metnini açar, esas ve karar numaralarını metin içinde doğrular; yalnızca bundan sonra cevap üretir.</p>
            <div className="principles">
              <div><b>01</b><span>Tam metin kontrolü</span></div>
              <div><b>02</b><span>Sunucu taraflı atıf</span></div>
              <div><b>03</b><span>Uydurma kaynak reddi</span></div>
            </div>
          </section>
        )}

        {researches.map((research, index) => (
          <div className="research" key={index}>
            <div className="question-card"><span>Soru</span><p>{research.question}</p></div>
            <AnswerView answer={research.answer} />
          </div>
        ))}

        {busy && (
          <section className="progress" aria-live="polite">
            <div className="progress-line"><div /></div>
            <div><strong>{status || "Araştırılıyor"}</strong>{detail && <span>{detail}</span>}</div>
          </section>
        )}
        {error && <div className="request-error" role="alert"><strong>Araştırma tamamlanamadı</strong><span>{error}</span></div>}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <textarea
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
          <button className="send" onClick={submit} disabled={busy || question.trim().length < 5} aria-label="Araştırmayı başlat">
            {busy ? "Bekleyin" : "Araştır"}
          </button>
        </div>
        <p>Her soru bağımsız araştırılır. Daha iyi sonuç için olay türü, hukuki sorun ve tarih aralığını açıkça yazın.</p>
      </div>
    </main>
  );
}
