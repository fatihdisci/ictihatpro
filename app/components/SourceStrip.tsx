"use client";

import type { Source } from "./types";

export function SourceStrip({
  sources,
  onCite,
}: {
  sources: Source[];
  onCite: (n: number) => void;
}) {
  return (
    <div className="source-strip">
      {sources.map((s, i) => {
        const n = i + 1;
        return (
          <a
            key={s.id}
            className={`cite-strip ${s.contradictory ? "is-contradictory" : ""}`}
            href={`#source-K${n}`}
            onClick={(e) => {
              e.preventDefault();
              onCite(n);
            }}
            title={`${s.mahkeme ?? ""} ${s.daire ?? ""} ${s.esasNo ?? ""}/${s.kararNo ?? ""}`}
          >
            <sup>[{n}]</sup>
            <span className="strip-text">
              {s.mahkeme ?? "Karar"}
              {s.daire ? ` ${s.daire}` : ""}
              {s.contradictory ? (
                <span className="contradiction-badge">Çelişki</span>
              ) : null}
            </span>
          </a>
        );
      })}
    </div>
  );
}
