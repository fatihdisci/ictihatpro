"use client";

import { motion } from "motion/react";
import { Markdown } from "./Markdown";
import { SourceCard } from "./SourceCard";
import { fadeUp, spring } from "../_lib/motion";
import type { Answer } from "../_lib/types";

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
    return (
      <motion.article className={`sheet${isEmpty ? " sheet-empty" : ""}`} {...sheetEnter}>
        <motion.div className="sources-head" {...fadeUp(0.12)} style={{ borderBottom: 0, paddingBottom: 0 }}>
          <div>
            <span className="eyebrow">Arama sonucu</span>
            <h3 style={{ marginTop: "0.25rem" }}>Bulunan kaynaklar</h3>
          </div>
          <span className="meta muted">{answer.sources.length} kaynak</span>
        </motion.div>
        {isEmpty ? (
          <motion.p className="muted" {...fadeUp(0.18)} style={{ marginTop: "1rem" }}>
            Seçilen kapsamda ilgili bir kaynak bulunamadı.
          </motion.p>
        ) : (
          <div className="source-list" style={{ marginTop: "1rem" }}>
            {answer.sources.map((source, index) => (
              <motion.div key={`${source.kind}-${source.id}`} {...fadeUp(0.18 + index * 0.05, 12)}>
                <SourceCard source={source} />
              </motion.div>
            ))}
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
