"use client";

import { motion } from "motion/react";
import { Markdown } from "./Markdown";
import { SourceCard } from "./SourceCard";
import { fadeUp, spring } from "../_lib/motion";
import { SOURCE_OPTIONS, type Answer, type DecisionSource, type ResearchSource } from "../_lib/types";

// Yaprağın kendi girişi: yükselerek belirir; iç öğeler ardından sırayla
// canlanır. (Önceki clip-path "kâğıt açılışı" bazı motorlarda `round`
// köşesiyle interpolasyonda takılıyordu; sağlam davranış için bırakıldı.)
const sheetEnter = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring.glide, opacity: { duration: 0.22 } },
};

function Cites({ ids, variant }: { ids: string[]; variant?: "margin" }) {
  if (!ids.length) return null;
  return (
    <span className={`cites${variant === "margin" ? " cites-margin" : ""}`} aria-label="Bu bölümün kaynakları">
      {ids.map((id) => (
        <a key={id} href={`#source-${id}`} className="cite" aria-label={`Kaynak ${id}`}>
          {id}
        </a>
      ))}
    </span>
  );
}

// Yaprak yükselerek belirir; iç öğeler açık gecikmelerle sırayla canlanır
// (variant yayılımına güvenmeden, HMR ile de tutarlı).
export function AnswerView({ answer }: { answer: Answer }) {
  const isEmpty = answer.sources.length === 0;

  if (answer.mode === "sources") {
    const legislation = answer.sources.filter((source) => source.kind === "legislation");
    const decisions = answer.sources.filter((source): source is DecisionSource => source.kind === "decision");
    const sourceForDecision = (source: DecisionSource): ResearchSource | null => {
      const label = `${source.court ?? ""} ${source.chamber ?? ""}`;
      if (/yargıtay/iu.test(label)) return "YARGITAY";
      if (/istinaf|bölge\s+adliye/iu.test(label)) return "ISTINAF";
      if (/danıştay/iu.test(label)) return "DANISTAY";
      if (/kanun\s+yararına|kyb/iu.test(label)) return "KYB";
      return null;
    };
    const searched = answer.searchedSources ?? [];
    const countFor = (source: ResearchSource) =>
      source === "MEVZUAT"
        ? legislation.length
        : decisions.filter((decision) => sourceForDecision(decision) === source).length;

    return (
      <motion.article className={`sheet result-sheet${isEmpty ? " sheet-empty" : ""}`} {...sheetEnter}>
        <motion.header className="result-head" {...fadeUp(0.12)}>
          <div>
            <span className="eyebrow">Arama sonucu</span>
            <h2>Kaynaklar</h2>
          </div>
          <div className="result-totals" aria-label="Sonuç sayıları">
            <span><strong>{decisions.length}</strong> karar</span>
            <span><strong>{legislation.length}</strong> mevzuat</span>
          </div>
        </motion.header>

        {searched.length > 0 && (
          <motion.div className="coverage" {...fadeUp(0.16)} aria-label="Aranan kaynaklar">
            {SOURCE_OPTIONS.filter((option) => searched.includes(option.id)).map((option) => {
              const count = countFor(option.id);
              return (
                <span className={`coverage-item${count === 0 ? " coverage-empty" : ""}`} key={option.id}>
                  {option.shortLabel}
                  <strong>{count}</strong>
                </span>
              );
            })}
          </motion.div>
        )}

        {isEmpty ? (
          <motion.p className="muted" {...fadeUp(0.18)} style={{ marginTop: "1rem" }}>
            Seçilen kapsamda ilgili bir kaynak bulunamadı.
          </motion.p>
        ) : (
          <div className="result-groups">
            {searched.includes("MEVZUAT") && legislation.length === 0 && (
              <motion.p className="result-missing" {...fadeUp(0.2)}>
                Mevzuatta doğrulanmış bir madde eşleşmesi bulunamadı.
              </motion.p>
            )}
            {legislation.length > 0 && (
              <section className="result-group result-group-legislation">
                <div className="result-group-head">
                  <h3>İlgili mevzuat</h3>
                  <span className="meta muted">{legislation.length} metin</span>
                </div>
                <div className="source-list">
                  {legislation.map((source, index) => (
                    <motion.div key={`${source.kind}-${source.id}`} {...fadeUp(0.2 + index * 0.04, 10)}>
                      <SourceCard source={source} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
            {decisions.length > 0 && (
              <section className="result-group">
                <div className="result-group-head">
                  <h3>İlgili kararlar</h3>
                  <span className="meta muted">{decisions.length} karar</span>
                </div>
                <div className="source-list">
                  {decisions.map((source, index) => (
                    <motion.div key={`${source.kind}-${source.id}`} {...fadeUp(0.24 + index * 0.04, 10)}>
                      <SourceCard source={source} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </motion.article>
    );
  }

  return (
    <motion.article
      className={`sheet${isEmpty ? " sheet-empty" : ""}`}
      {...sheetEnter}
    >
      <motion.header className="sheet-head" {...fadeUp(0.12)}>
        <span className="eyebrow">Doğrulanmış araştırma özeti</span>
        <h2>{answer.title}</h2>
      </motion.header>

      <motion.div className="lede prose" {...fadeUp(0.2)}>
        <Markdown>{answer.summary}</Markdown>
        <Cites ids={answer.summarySourceIds} />
      </motion.div>

      {answer.sections.map((section, index) => (
        <motion.section className="section" key={`${section.heading}-${index}`} {...fadeUp(0.28 + index * 0.06)}>
          <div className="section-body">
            <h3>{section.heading}</h3>
            <div className="prose">
              <Markdown>{section.text}</Markdown>
            </div>
          </div>
          <Cites ids={section.sourceIds} variant="margin" />
        </motion.section>
      ))}

      {answer.limitations.length > 0 && (
        <motion.aside className="limits" {...fadeUp(0.34)}>
          <h3>Sınırlar ve kontrol notları</h3>
          <ul>
            {answer.limitations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </motion.aside>
      )}

      {answer.sources.length > 0 && (
        <motion.section className="sources" {...fadeUp(0.4)}>
          <div className="sources-head">
            <h3>Doğrulanmış kararlar</h3>
            <span className="meta muted">{answer.sources.length} kaynak</span>
          </div>
          <div className="source-list">
            {answer.sources.map((source) => (
              <SourceCard source={source} key={source.id} />
            ))}
          </div>
        </motion.section>
      )}

      <motion.p className="disclaimer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...spring.glide, delay: 0.46 }}>
        Bu çıktı kaynak kontrollü bir araştırma taslağıdır; dosya özelinde nihai hukukî değerlendirme yerine geçmez.
      </motion.p>
    </motion.article>
  );
}
