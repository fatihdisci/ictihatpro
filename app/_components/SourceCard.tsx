"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Markdown } from "./Markdown";
import { Check, Chevron, Copy, Document, External } from "./Icons";
import { spring } from "../_lib/motion";
import type { Source } from "../_lib/types";

type DecisionText =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; mimeType: string };

export function SourceCard({ source }: { source: Source }) {
  const [documentOpen, setDocumentOpen] = useState(false);
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionText | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || source.kind !== "decision") return;
    if (documentOpen && !dialog.open) dialog.showModal();
    if (!documentOpen && dialog.open) dialog.close();
  }, [documentOpen, source.kind]);

  async function openDocument() {
    if (source.kind !== "decision") return;
    setDocumentOpen(true);
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
      // Pano izni yoksa düğme değişmeden kalır.
    }
  }

  const excerptCanCollapse = source.excerpt.length > 720;

  return (
    <>
      <motion.article
        className={`source source-${source.kind}`}
        id={`source-${source.id}`}
        layout="position"
        transition={spring.soft}
      >
        <div className="source-grid">
          <div className="source-heading">
            <span className="source-kind">{source.kind === "decision" ? "Karar" : "Mevzuat"}</span>
            {source.kind === "decision" ? (
              <>
                <h4>{[source.court, source.chamber].filter(Boolean).join(" · ") || "Mahkeme bilgisi yok"}</h4>
                <div className="source-meta meta">
                  <span>{source.esasNo ? `${source.esasNo} E.` : "Esas no doğrulanamadı"}</span>
                  <span>{source.kararNo ? `${source.kararNo} K.` : "Karar no doğrulanamadı"}</span>
                  <span>{source.date ?? "Tarih doğrulanamadı"}</span>
                </div>
                {!source.evidenceComplete && <span className="flag-partial">Seçili pasajlar incelendi</span>}
              </>
            ) : (
              <>
                <h4>{source.name}</h4>
                <div className="source-meta meta">
                  <span>{source.number ? `${source.number} sayılı` : "Numara bilgisi yok"}</span>
                  <span>{source.type ?? "Mevzuat"}</span>
                  {source.officialGazetteDate && <span>RG {source.officialGazetteDate}</span>}
                  {source.officialGazetteNumber && <span>Sayı {source.officialGazetteNumber}</span>}
                </div>
              </>
            )}
          </div>

          <div className="source-actions">
            {source.kind === "decision" && (
              <button className="act" onClick={openDocument} aria-haspopup="dialog">
                <Document />
                Tam metin
              </button>
            )}
            <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="act">
              <External />
              {source.kind === "decision" ? "Resmî kayıt" : "Resmî metin"}
            </a>
          </div>
        </div>

        <div className={`excerpt${excerptCanCollapse ? " excerpt-collapsible" : ""}${excerptOpen ? " excerpt-open" : ""}`}>
          <span className="excerpt-label">{source.kind === "legislation" ? "İlgili madde" : "İlgili bölüm"}</span>
          <div className="excerpt-body">
            <Markdown>{source.excerpt}</Markdown>
          </div>
          {excerptCanCollapse && (
            <button className="excerpt-toggle" onClick={() => setExcerptOpen((value) => !value)} aria-expanded={excerptOpen}>
              {excerptOpen ? "Daha az göster" : "Bölümün devamı"}
              <motion.span animate={{ rotate: excerptOpen ? 180 : 0 }} transition={spring.snap}>
                <Chevron size={13} />
              </motion.span>
            </button>
          )}
        </div>
      </motion.article>

      {source.kind === "decision" && (
        <dialog
          ref={dialogRef}
          className="document-dialog"
          aria-labelledby={`document-title-${source.id}`}
          onClose={() => setDocumentOpen(false)}
          onCancel={() => setDocumentOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDocumentOpen(false);
          }}
        >
          <div className="document-dialog-head">
            <div>
              <span className="source-kind">Karar metni</span>
              <h3 id={`document-title-${source.id}`}>
                {[source.court, source.chamber].filter(Boolean).join(" · ") || "Karar"}
              </h3>
              <p className="meta">
                {[source.esasNo && `${source.esasNo} E.`, source.kararNo && `${source.kararNo} K.`, source.date]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button className="dialog-close" onClick={() => setDocumentOpen(false)} aria-label="Karar metnini kapat">
              Kapat
            </button>
          </div>
          <div className="document-dialog-body" aria-live="polite">
            {decision?.status === "ready" && (
              <div className="fulltext-bar">
                <button className="act" onClick={copyText}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Kopyalandı" : "Metni kopyala"}
                </button>
              </div>
            )}
            {(!decision || decision.status === "loading") && <p className="muted">Karar metni yükleniyor…</p>}
            {decision?.status === "error" && <p className="error-text">{decision.message}</p>}
            {decision?.status === "ready" &&
              (decision.mimeType.includes("pdf") ? <pre>{decision.text}</pre> : <Markdown>{decision.text}</Markdown>)}
          </div>
        </dialog>
      )}
    </>
  );
}
