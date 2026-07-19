function focusTerms(focus: string): string[] {
  const stop = new Set(["ve", "veya", "ile", "için", "bir", "bu", "şu", "olan", "olarak", "nedir", "nasıl"]);
  return [...new Set(focus.toLocaleLowerCase("tr-TR").match(/[a-zçğıöşü0-9]{4,}/giu) ?? [])]
    .filter((term) => !stop.has(term))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
}

export function selectEvidence(body: string, focus: string, maxChars = 60_000): { text: string; complete: boolean } {
  if (body.length <= maxChars) return { text: body, complete: true };

  const chunks = [body.slice(0, 10_000), body.slice(-12_000)];
  const lower = body.toLocaleLowerCase("tr-TR");
  const buckets = new Set<number>();
  for (const term of focusTerms(focus)) {
    let from = 0;
    for (let hit = 0; hit < 4; hit += 1) {
      const index = lower.indexOf(term, from);
      if (index < 0) break;
      const start = Math.max(0, index - 3500);
      const bucket = Math.floor(start / 4000);
      if (!buckets.has(bucket)) {
        buckets.add(bucket);
        chunks.push(body.slice(start, start + 7500));
      }
      from = index + term.length;
    }
  }

  return {
    text: chunks.join("\n\n--- [aynı belgenin başka bölümü] ---\n\n").slice(0, maxChars),
    complete: false,
  };
}
