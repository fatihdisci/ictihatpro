const GENERIC_TERMS = new Set([
  "ve", "veya", "ile", "için", "bir", "bu", "şu", "olan", "olarak", "nedir", "nasıl", "eski", "türk",
  "ilişkin", "içtihat", "içtihatları", "karar", "kararları", "bul", "getir", "göster", "hakkında", "dair",
  "dava", "davası", "davada", "şart", "şartları", "koşul", "koşulları", "belirleme", "belirlemesi", "değerlendirilir",
  "davasının", "nedeni", "nedeniyle", "ispat", "ispatı", "hangi", "bakımından", "uygun", "ilgili", "yapılır",
  "edilir", "istenir", "gerekir", "maddi", "manevi",
]);

function genericTerm(term: string): boolean {
  return GENERIC_TERMS.has(term) || /^(?:belirle|değerlendir|koşul|şart)/u.test(term);
}

function termForms(term: string): string[] {
  const forms = new Set([term]);
  // Türkçede ek alırken görülen ünsüz yumuşamasını da arama kökü say:
  // ihtiyaç → ihtiyacı, hukuk → hukuka gibi biçimler aksi hâlde kaçıyordu.
  const softened = { p: "b", ç: "c", t: "d", k: "ğ" }[term.at(-1) ?? ""];
  if (softened && term.length >= 5) forms.add(`${term.slice(0, -1)}${softened}`);
  let current = term;
  const suffixes = [
    "lerinin", "larının", "lerden", "lardan", "lerin", "ların", "sından", "sinden", "sına", "sine",
    "nın", "nin", "nun", "nün", "dan", "den", "dır", "dir", "dur", "dür", "ları", "leri", "da", "de",
  ];
  for (const suffix of suffixes) {
    if (current.length - suffix.length >= 5 && current.endsWith(suffix)) {
      current = current.slice(0, -suffix.length);
      forms.add(current);
      break;
    }
  }
  if (current.length > 7 && /(?:ma|me)$/u.test(current)) forms.add(current.slice(0, -2));
  return [...forms];
}

export function normalizeLegalText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKC")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function distinctiveTerms(value: string, max = 12): string[] {
  const quoted = [...value.matchAll(/"([^"]{3,})"/g)].map((match) => normalizeLegalText(match[1]));
  const words = normalizeLegalText(value).match(/[a-zçğıöşü0-9]{4,}/giu) ?? [];
  return [...new Set([...quoted, ...words])]
    .filter((term) => !genericTerm(term) && !/^(?:and|or|not)$/i.test(term))
    .sort((a, b) => b.length - a.length)
    .slice(0, max);
}

export function relevanceMatches(focus: string, body: string): { matches: string[]; required: number } {
  const terms = distinctiveTerms(focus);
  const text = normalizeLegalText(body);
  const matches = terms.filter((term) => termForms(term).some((form) => text.includes(form)));
  return { matches, required: Math.min(2, terms.length) };
}

export function decisionBooleanQuery(value: string): string {
  const phrase = value.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(?:AND|OR|NOT)\b|["()]/.test(phrase)) return phrase;

  const terms = distinctiveTerms(phrase, 4);
  const hasTurkishLira = /türk\s+liras/iu.test(phrase);
  const selected = terms.filter((term) => !(hasTurkishLira && term.startsWith("lira"))).slice(0, 3);
  if (hasTurkishLira) selected.push('"türk lirası"');
  return selected.join(" AND ") || phrase;
}

/** Bedesten mevzuat tam metin aramasında AND yerine +zorunlu sözdizimi kullanılır. */
export function legislationSolrQuery(value: string): string {
  const terms = distinctiveTerms(value, 3);
  return terms.map((term) => (term.includes(" ") ? `+"${term}"` : `+${term}`)).join(" ");
}

type Article = { start: number; text: string };

/**
 * Türk mevzuatında kenar başlıkları ("b. Kullanma yasağı, feragat ve hak
 * düşürücü süre") ait oldukları maddeden ÖNCE gelir. Metin "Madde N"den
 * bölündüğü için bu başlıklar bir önceki maddenin sonunda kalır ve o maddeye
 * ait sayılır. Sonuç: başlıktaki kavramlar yanlış maddeye puan kazandırır;
 * örneğin "Yasal önalım hakkı" başlığı TMK 731'i, asıl 732'nin önüne geçirir.
 * Bu yüzden sondaki başlık satırları sonraki maddeye taşınır.
 */
function isHeadingLine(line: string): boolean {
  const text = line.trim();
  if (!text || /madde\s+\d/iu.test(text)) return false;
  const bare = text.replace(/^\*+|\*+$/g, "").replace(/^#+\s*/, "").trim();
  if (!bare || bare.length > 120) return false;
  // Ya tamamen kalın yazılmış bir satır ya da "II.", "1.", "a." gibi bir
  // bölüm numarasıyla başlayan kısa bir satır başlıktır.
  const fullyBold = /^\*\*.*\*\*$/.test(text);
  const numbered = /^(?:[IVXLCDM]{1,6}|\d{1,2}|[a-zçğıöşü])\s*\\?\.\s+\S/u.test(bare);
  return fullyBold || numbered;
}

function detachTrailingHeadings(text: string): { body: string; headings: string } {
  const lines = text.split("\n");
  let cut = lines.length;
  let moved = 0;
  for (let index = lines.length - 1; index >= 0 && moved < 8; index -= 1) {
    const line = lines[index];
    if (!line.trim()) {
      cut = index;
      continue;
    }
    if (!isHeadingLine(line)) break;
    cut = index;
    moved += 1;
  }
  if (moved === 0) return { body: text, headings: "" };
  return { body: lines.slice(0, cut).join("\n").trim(), headings: lines.slice(cut).join("\n").trim() };
}

function splitArticles(body: string): Article[] {
  const pattern = /(?:^|\n)\s*(?:#{1,6}\s*)?\*{0,2}(?:(?:ek|geçici|mükerrer)\s+)?madde\s+\d+(?:\s*\/\s*[a-zçğıöşü0-9]+)?\s*[.\-–—:]*/gimu;
  const starts = [...body.matchAll(pattern)].map((match) => match.index ?? 0);
  const raw = starts.map((start, index) => ({
    start,
    text: body.slice(start, starts[index + 1] ?? body.length).trim(),
  }));

  const articles: Article[] = [];
  let pending = "";
  for (const article of raw) {
    const { body: own, headings } = detachTrailingHeadings(article.text);
    articles.push({ start: article.start, text: pending ? `${pending}\n\n${own}` : own });
    pending = headings;
  }
  return articles;
}

function queryGroups(query: string): string[][] {
  const clauses = query.split(/\s+AND\s+/i);
  return clauses.map((clause) => distinctiveTerms(clause, 8)).filter((group) => group.length > 0);
}

function scoreArticle(text: string, groups: string[][], requireEveryGroup: boolean): number {
  const normalized = normalizeLegalText(text);
  const groupScores = groups.map((group) =>
    group.reduce((score, term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = normalized.match(new RegExp(escaped, "gu"))?.length ?? 0;
      return score + count * (term.includes(" ") ? 3 : 1);
    }, 0)
  );
  if (requireEveryGroup && groupScores.some((score) => score === 0)) return 0;
  if (!requireEveryGroup && groupScores.every((score) => score === 0)) return 0;
  return groupScores.reduce((sum, score) => sum + score, 0);
}

/**
 * Ayırt ediciliği toplam geçiş sayısıyla ölçmek yanıltır: bir terim tek bir
 * maddede onlarca kez geçebilir. Konuyu tanımlayan terim az sayıda maddeye
 * yoğunlaşır ("önalım"), sık kelime ise kanunun her yerine dağılır ("yasal").
 * Bu yüzden ölçüt, terimin geçtiği madde sayısıdır.
 */
function articleFrequency(articles: Article[], group: string[]): number {
  return articles.filter((article) => {
    const normalized = normalizeLegalText(article.text);
    return group.some((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(escaped, "u").test(normalized);
    });
  }).length;
}

function rank(articles: Article[], groups: string[][], requireEveryGroup: boolean) {
  return articles
    .map((article) => ({ ...article, score: scoreArticle(article.text, groups, requireEveryGroup) }))
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || a.start - b.start);
}

/**
 * Bir hukukî konu tek maddeye sığmaz: önalımda bildirim, süre ve bedel üç ayrı
 * maddededir. Bu yüzden birden çok madde döndürülür ve AND sorgusu yeterli
 * madde bulamazsa kalan yerler gevşetilmiş (OR) eşleşmeyle doldurulur. Aksi
 * hâlde dar bir sorgu, konunun asıl maddelerini sessizce eler.
 */
export function relevantLegislationArticles(body: string, query: string, maxArticles = 4, maxChars = 9000): string {
  const articles = splitArticles(body);
  if (articles.length === 0) return "";
  const groups = queryGroups(query);
  if (groups.length === 0) return "";
  const requireEveryGroup = /\s+AND\s+/i.test(query);

  const chosen = rank(articles, groups, requireEveryGroup).slice(0, maxArticles);
  if (requireEveryGroup && chosen.length < maxArticles && groups.length > 1) {
    // Gevşetme "herhangi bir terim"e açılırsa "yasal" gibi sık geçen bir
    // kelime konuyla ilgisiz maddeleri öne çıkarır. Bu yüzden yalnızca
    // belgede en seyrek geçen — yani konuyu asıl tanımlayan — terim grubu
    // aranır: önalım/tahliye gibi.
    const distinctive = [...groups].sort(
      (a, b) => articleFrequency(articles, a) - articleFrequency(articles, b)
    )[0];
    const taken = new Set(chosen.map((article) => article.start));
    for (const article of rank(articles, [distinctive], true)) {
      if (chosen.length >= maxArticles) break;
      if (!taken.has(article.start)) chosen.push(article);
    }
  }

  return chosen
    .sort((a, b) => a.start - b.start)
    .map((article) => article.text.slice(0, 3000))
    .join("\n\n---\n\n")
    .slice(0, maxChars)
    .trim();
}

export function focusedExcerpt(body: string, focus: string, maxChars = 3600): string {
  const lower = normalizeLegalText(body);
  const first = distinctiveTerms(focus)
    .flatMap((term) => termForms(term).map((form) => lower.indexOf(form)))
    .find((index) => index >= 0) ?? 0;
  const start = Math.max(0, first - 700);
  return body.slice(start, start + maxChars).trim();
}
