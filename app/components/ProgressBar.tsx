"use client";

import { useEffect, useState } from "react";
import type { Progress } from "./types";

export function ProgressBar({
  progress,
  sourceCount,
}: {
  progress: Progress;
  sourceCount: number;
}) {
  const total =
    progress.total && progress.total > 0 ? progress.total : Math.max(sourceCount, 3);
  const filled = Math.max(0, Math.min(progress.current, total));
  return (
    <div className="progress" aria-live="polite">
      <span className="progress-label">
        {progress.label ?? "İlerleniyor"} · {filled}/{total} karar doğrulandı
      </span>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`progress-segment ${i < filled ? "is-filled" : ""}`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

export function RateCountdown({
  retryAt,
  onRetry,
  busy,
}: {
  retryAt: number;
  onRetry: () => void;
  busy: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return (
    <div className="rate-countdown">
      <span className="muted tiny">
        {left > 0 ? `${left} sn sonra otomatik deneyeceğim` : "Hazır"}
      </span>
      <button
        type="button"
        className="text-button"
        disabled={left > 0 || busy}
        onClick={onRetry}
      >
        Şimdi tekrar dene
      </button>
    </div>
  );
}
