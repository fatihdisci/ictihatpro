"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "./Icons";

type State = "idle" | "copied" | "failed";

/**
 * Pano API'si yalnızca güvenli bağlamda ve kullanıcı hareketiyle çalışır.
 * İzin verilmediğinde sessiz kalmak yerine durum bildirilir; aksi hâlde
 * kullanıcı kopyaladığını sanıp boş yapıştırır.
 */
export function CopyButton({
  text,
  label = "Kopyala",
  title,
  className = "act act-copy",
}: {
  text: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash(next: State) {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  async function copy() {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      flash("copied");
    } catch {
      flash("failed");
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={copy}
      title={title ?? label}
      aria-label={title ?? label}
      data-state={state}
    >
      {state === "copied" ? <Check /> : <Copy />}
      <span>{state === "copied" ? "Kopyalandı" : state === "failed" ? "Kopyalanamadı" : label}</span>
    </button>
  );
}
