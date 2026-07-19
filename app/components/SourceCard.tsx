"use client";

import { useState } from "react";
import type { Source } from "./types";

export function SourceCard({
  index,
  source,
  expanded,
  onToggle,
}: {
  index: number;
  source: Source;
  expanded: boolean;
  onToggle: () => void;
}) {
  const id = `source-K${index}`;
  const text = source.fullText ?? source.summary ?? "";
  return (
    <article
      id={id}
      className={`source-card ${source.contradictory ? "is-contradictory" : ""}`}
      tabIndex={-1}
    >
      <header className="source-head">
        <span className="cite-marker" aria-label={`Kaynak ${index}`}>[{index}]</span>
        <div className="source-meta">
          <span className="court">
            {source.mahkeme ?? "Karar"}
            {source.daire ? ` · ${source.daire}` : ""}
          </span>
          {(source.esasNo || source.kararNo) && (
            <span className="case-no">
              {source.esasNo ? `E. ${source.esasNo}` : ""}
              {source.kararNo ? ` K. ${source.kararNo}` : ""}
            </span>
          )}
          {source.tarih && <span className="date">{source.tarih}</span>}
        </div>
        {source.contradictory && (
          <span className="contradiction-badge">Çelişki</span>
        )}
      </header>
      {source.title && <p className="source-title">{source.title}</p>}
      <div className="source-actions">
        <button
          type="button"
          className="source-toggle"
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          onClick={onToggle}
        >
          {expanded ? "Kapat" : "Tam metin"}
        </button>
        {source.fullText && expanded && <CopyButton text={source.fullText} />}
      </div>
      {expanded && (
        <div className="decision-text" id={`${id}-body`}>
          {text ? (
            <pre>{text}</pre>
          ) : (
            <p className="muted tiny">Bu karar için tam metin getirilmedi.</p>
          )}
        </div>
      )}
    </article>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={copied ? "Karar metni kopyalandı" : "Karar metnini kopyala"}
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* yoksay */
        }
      }}
    >
      {copied ? "✓ Kopyalandı" : "📋 Kopyala"}
    </button>
  );
}
