"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "./Icons";
import { dockProps, spring, tickerProps } from "../_lib/motion";
import { SOURCE_OPTIONS, type ResearchSource } from "../_lib/types";

type ComposerProps = {
  docked: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  dockRef: RefObject<HTMLDivElement | null>;
  question: string;
  setQuestion: (value: string) => void;
  selectedSources: ResearchSource[];
  toggleSource: (source: ResearchSource) => void;
  busy: boolean;
  canSend: boolean;
  submit: () => void;
  status: string;
  detail: string;
  progressCount: number;
};

/**
 * Tek composer, iki yerleşim:
 *  - docked=false → karşılama ekranında, hero'nun içinde, akışta sabit.
 *  - docked=true  → sohbet başladığında ekranın altına sabitlenmiş yüzer panel.
 * İki durumda da aynı alanları ve klavye davranışını paylaşır. `dockRef` sabit
 * moddaki gerçek yüksekliği ölçmek için dış kaba bağlanır.
 */
export function Composer({
  docked,
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
}: ComposerProps) {
  const inner = (
    <div className="read composer-stack">
      <AnimatePresence>
        {busy && (
          <motion.section className="status" aria-live="polite" {...dockProps}>
            <span aria-hidden="true" className="status-spin" />
            <div className="status-body">
              <strong>
                {progressCount > 0 && <span className="status-count">{progressCount}</span>}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={status} {...tickerProps}>
                    {status || "Araştırılıyor"}
                  </motion.span>
                </AnimatePresence>
              </strong>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={detail} className="status-detail" {...tickerProps}>
                  {detail || "Seçilen kaynaklar taranıyor; bu alan araştırma boyunca görünür kalır."}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="composer">
        <textarea
          ref={textareaRef}
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
          rows={docked ? 1 : 2}
          maxLength={6000}
          disabled={busy}
          aria-label="Yeni araştırma sorusu"
        />
        <div className="composer-bar">
          <div className="scopes" role="group" aria-label="Aranacak kaynaklar">
            {SOURCE_OPTIONS.map((source) => {
              const selected = selectedSources.includes(source.id);
              return (
                <motion.button
                  key={source.id}
                  type="button"
                  className="scope"
                  onClick={() => toggleSource(source.id)}
                  aria-pressed={selected}
                  title={source.label}
                  disabled={busy || (selected && selectedSources.length === 1)}
                  whileTap={{ scale: 0.94 }}
                  transition={spring.snap}
                >
                  {source.shortLabel}
                </motion.button>
              );
            })}
          </div>
          <motion.button
            className="send"
            onClick={submit}
            disabled={!canSend}
            aria-label="Araştırmayı başlat"
            whileTap={{ scale: 0.9 }}
            transition={spring.snap}
          >
            <ArrowUp />
          </motion.button>
        </div>
      </div>

      <p className="composer-hint">
        <kbd>↵</kbd> araştır · <kbd>⇧ ↵</kbd> yeni satır — her soru bağımsız araştırılır
      </p>
    </div>
  );

  if (!docked) return inner;
  return (
    <div className="composer-dock" ref={dockRef}>
      {inner}
    </div>
  );
}
