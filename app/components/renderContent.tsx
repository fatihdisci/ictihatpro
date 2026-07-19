"use client";

import type { ReactNode } from "react";

/**
 * Asistan içeriğindeki [1], [2] ... markerlarını yakalar, geçerli kaynak
 * aralığındaysa tıklanabilir sup rozetine dönüştürür. Aksi halde düz metin
 * olarak bırakır (ör. [99] hiçbir şeyle eşleşmiyorsa).
 */
export function renderContent(
  content: string,
  sourceCount: number,
  onCite: (n: number) => void,
): ReactNode {
  const re = /\[(\d{1,3})\]/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(content)) !== null) {
    const n = Number(m[1]);
    const valid = Number.isInteger(n) && n >= 1 && n <= sourceCount;
    if (m.index > lastIndex) parts.push(content.slice(lastIndex, m.index));
    if (valid) {
      parts.push(
        <sup key={`cite-${key++}-${n}`}>
          <a
            className="cite"
            href={`#source-K${n}`}
            onClick={(e) => {
              e.preventDefault();
              onCite(n);
            }}
            aria-label={`Kaynak ${n} bölümüne atla`}
          >
            [{n}]
          </a>
        </sup>,
      );
    } else {
      parts.push(m[0]);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return <>{parts}</>;
}
