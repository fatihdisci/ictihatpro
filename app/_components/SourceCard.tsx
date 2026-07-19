"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Markdown } from "./Markdown";
import { Check, Chevron, Copy, Document, External } from "./Icons";
import { spring } from "../_lib/motion";
import type { Source } from "../_lib/types";

type DecisionText =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; text: string; mimeType: string };

export function SourceCard({ source }: { source: Source }) {
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
    <motion.article className="source" id={`source-${source.id}`} layout="position" transition={spring.soft}>
      <div className="source-grid">
        <div style={{ minWidth: 0 }}>
          {source.kind === "decision" ? (
            <>
              <div className="source-title">
                <span className="source-tag">{source.id}</span>
                <strong>{[source.court, source.chamber].filter(Boolean).join(" · ") || "Mahkeme bilgisi yok"}</strong>
              </div>
              <div className="source-meta meta">
                <span>{source.esasNo ? `${source.esasNo} E.` : "Esas no doğrulanamadı"}</span>
                <span>{source.kararNo ? `${source.kararNo} K.` : "Karar no doğrulanamadı"}</span>
                <span>{source.date ?? "Tarih doğrulanamadı"}</span>
              </div>
              <div className="source-foot">
                <span className="meta">Bedesten {source.documentId}</span>
                {!source.evidenceComplete && <span className="flag-partial">Seçili pasajlar incelendi</span>}
              </div>
            </>
          ) : (
            <>
              <div className="source-title">
                <span className="source-tag">{source.id}</span>
                <strong>{source.name}</strong>
              </div>
              <div className="source-meta meta">
                <span>{source.number ? `${source.number} sayılı` : "Numara bilgisi yok"}</span>
                <span>{source.type ?? "Mevzuat"}</span>
                <span>{source.officialGazetteDate ?? "RG tarihi yok"}</span>
              </div>
              <div className="source-foot">
                {source.officialGazetteNumber && <span className="meta">RG {source.officialGazetteNumber}</span>}
                {!source.evidenceComplete && <span className="flag-partial">İlgili bölüm incelendi</span>}
              </div>
            </>
          )}
        </div>

        <div className="source-actions">
          {source.kind === "decision" && (
            <button className="act" onClick={toggleText} aria-expanded={open} aria-controls={`fulltext-${source.id}`}>
              <Document />
              {open ? "Metni gizle" : "Tam metin"}
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={spring.snap}
                style={{ display: "grid", placeItems: "center" }}
              >
                <Chevron size={13} />
              </motion.span>
            </button>
          )}
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="act">
            <External />
            {source.kind === "decision" ? "Resmî sistem" : "Resmî metin"}
          </a>
        </div>
      </div>

      <div className="excerpt">
        <span className="excerpt-label">İlgili bölüm</span>
        <Markdown>{source.excerpt}</Markdown>
      </div>

      {/* Yükseklik yaydan geçerek açılır; içerik kutuyu itmez, kutu içeriğe
          uyar. `hidden` sırasında overflow kesilir ki metin dışarı taşmasın. */}
      <AnimatePresence initial={false}>
        {source.kind === "decision" && open && (
          <motion.div
            key="fulltext"
            id={`fulltext-${source.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: spring.soft, opacity: { duration: 0.18 } }}
            style={{ overflow: "hidden" }}
          >
            <div className="fulltext" aria-live="polite" style={{ marginTop: "0.75rem" }}>
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
