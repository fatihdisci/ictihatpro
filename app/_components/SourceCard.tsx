"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Markdown } from "./Markdown";
import { CopyButton } from "./CopyButton";
import { Chevron, Document, External } from "./Icons";
import { spring } from "../_lib/motion";
import type { Source } from "../_lib/types";

/**
 * Kopyalanan metin tek başına atıf yapılabilir olmalı: künye ve resmî bağlantı
 * olmadan yapıştırılan bir pasaj dilekçede kaynaksız kalır.
 */
function citation(source: Source): string {
  if (source.kind === "decision") {
    const heading = [source.court, source.chamber].filter(Boolean).join(" · ") || "Karar";
    const numbers = [
      source.esasNo && `${source.esasNo} E.`,
      source.kararNo && `${source.kararNo} K.`,
      source.date,
    ]
      .filter(Boolean)
      .join(" · ");
    return [heading, numbers, source.sourceUrl].filter(Boolean).join("\n");
  }
  const heading = [source.name, source.number && `${source.number} sayılı`].filter(Boolean).join(" · ");
  const gazette = [
    source.officialGazetteDate && `RG ${source.officialGazetteDate}`,
    source.officialGazetteNumber && `Sayı ${source.officialGazetteNumber}`,
  ]
    .filter(Boolean)
    .join(" / ");
  return [heading, gazette, source.sourceUrl].filter(Boolean).join("\n");
}

type DecisionText =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; mimeType: string };

export function SourceCard({ source }: { source: Source }) {
  const [documentOpen, setDocumentOpen] = useState(false);
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionText | null>(null);
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

  const excerptCanCollapse = source.excerpt.length > 720;
  const reference = citation(source);

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
            <CopyButton
              text={reference}
              label="Künye"
              title="Künyeyi ve resmî bağlantıyı kopyala"
              className="act"
            />
          </div>
        </div>

        <div className={`excerpt${excerptCanCollapse ? " excerpt-collapsible" : ""}${excerptOpen ? " excerpt-open" : ""}`}>
          <div className="excerpt-head">
            <span className="excerpt-label">{source.kind === "legislation" ? "İlgili madde" : "İlgili bölüm"}</span>
            <CopyButton
              text={`${reference}\n\n${source.excerpt}`}
              title={
                source.kind === "legislation"
                  ? "Madde metnini künyesiyle birlikte kopyala"
                  : "Pasajı künyesiyle birlikte kopyala"
              }
            />
          </div>
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
                <CopyButton
                  text={`${reference}\n\n${decision.text}`}
                  label="Metni kopyala"
                  title="Karar metnini künyesiyle birlikte kopyala"
                  className="act"
                />
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
