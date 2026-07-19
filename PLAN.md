# İçtihat Asistanı — UI/UX Olgunlaşma Planı

Bu plan, **mavis team plan** için tek kaynaktır. Üç implementation stream paralel çalışır,
ardından iki verification stream gelir. **lib/research.ts yok**, **lib/bedesten.ts'a dokunulmaz**;
sadece görsel katman + tel şeması genişlemesi yapılır.

---

## 1. Marka Kimliği (KORUNACAK)

### 1.1 Renk Tokenları

**Açık tema (default, html):**
| Token | Değer | Kullanım |
|---|---|---|
| `--paper` | `#f3f0e8` | Sayfa zemini (sıcak krem) |
| `--panel` | `#fbfaf6` | Kart / kutu zemini (paper'dan biraz açık) |
| `--ink` | `#1f2421` | Birincil metin (saf siyah yerine sıcak kömür) |
| `--muted` | `#5b625b` | Yardımcı metin — WCAG AA: paper üzerinde ≥ 4.5:1 |
| `--line` | `#d8d2c2` | Ayraç, sınır |
| `--forest` | `#183c34` | Birincil vurgu (başlık, link, marka) |
| `--gold` | `#ae8240` | İkincil vurgu (citation, progress, ikon) |
| `--gold-soft` | `#e8d9b8` | Gold açık arka plan (badge dolgu) |
| `--user` | `#e8e2d0` | Kullanıcı balonu (panel'den ayrışık, paper'a yakın) |
| `--err` | `#a8312e` | Hata metni (kırmızı yerine koyu tuğla) |
| `--warn` | `#a05a00` | Uyarı / rate limit (amber-kahve) |

**Koyu tema (html[data-theme="dark"]):**
| Token | Değer | Not |
|---|---|---|
| `--paper` | `#0f1714` | Koyu orman zemin |
| `--panel` | `#16201c` | Kart zemini (paper'dan ayrışık) |
| `--ink` | `#ece8db` | Krem metin |
| `--muted` | `#a8a89c` | Yardımcı metin (AA için açıldı) |
| `--line` | `#2a352f` | Ayraç |
| `--forest` | `#4a8a73` | Birincil vurgu (koyu temada açıldı) |
| `--gold` | `#d4a55c` | Altın (koyu temada daha parlak) |
| `--gold-soft` | `#3a2f1a` | Gold arka plan (koyu) |
| `--user` | `#1d2a25` | Kullanıcı balonu |
| `--err` | `#e07b78` | Açık kırmızı |
| `--warn` | `#e0a85a` | Açık amber |

**Toggle:** `prefers-color-scheme` default; kullanıcı `html[data-theme="..."]` ile override eder;
`localStorage["ictihat-theme"]` saklanır; ilk yükleme için `<head>`'e inline script (FOUC önleme).

### 1.2 Tipografi

- **Başlıklar:** `Georgia, "Times New Roman", serif` (mevcut marka)
- **Gövde:** `Inter, ui-sans-serif, system-ui, sans-serif` — `next/font/google` ile self-host,
  `app/layout.tsx`'te `inter` class, CSS variable `--font-inter`
- **Ölçek:** gövde 16px / 1.6 line-height; h1 28-30px; h2 20px; small 13-14px
- **Tabular nums:** citation badge ve progress için `font-variant-numeric: tabular-nums`

### 1.3 Spacing & Radius

- Spacing: `--sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px`
- Radius: `--r-sm: 8px; --r-md: 12px; --r-lg: 16px`
- Shadow: `--shadow-sm: 0 1px 2px rgba(31,36,33,.06); --shadow-md: 0 4px 16px rgba(31,36,33,.08)`

### 1.4 Breakpoint Sistemi (tutarlı)

- `--max-w: 720px` (ana içerik — content + composer paylaşır)
- `--max-w-wide: 1020px` (yalnızca topbar, üst yatay çubuk)
- Tek responsive breakpoint: **720px** (mobil eşik) + **1020px** (geniş ekran eşik)
- `topbar { max-width: var(--max-w-wide); margin: 0 auto; padding: 14px 20px; }`
- `app/main { max-width: var(--max-w); margin: 0 auto; }`
- Bu sayede 700/920/1020px tutarsızlığı biter; tablet aralığı (720-1020px) padding ile yönetilir.

---

## 2. Bileşen Seti

### 2.1 SourceCard (`<article class="source-card">`)
- Üst satır: mahkeme + daire + esasNo/kararNo + tarih + citation badge (`<sup class="cite">[1]</sup>`)
- Body: 1-2 satır özet (LLM'den gelirse), yoksa "—" placeholder
- "Tam metin" toggle: sağ üstte 📋 kopyala + ✕ kapat düğmesi; açıkken gövde genişler
- Açık gövde (`<div class="decision-text">`): `max-height: 60vh; overflow: auto;` (mobilde kalkar)
- "▲ Başa dön" sticky button (decision-text içinde, scrollTop > 200 olunca görünür)
- Border-left accent: `border-left: 3px solid var(--gold)` ile gold şerit

### 2.2 AnswerCard (`<article class="answer-card">`)
- Tek kaynaklı cevap: gövde + alt satırda inline kaynak linki ("Yargıtay 9. HD · 2023/1234 E. [1]")
- Çoklu kaynaklı: kaynaklar yan yana mini-kartlar (`<div class="source-strip">`); çelişki varsa
  her birinin solunda `border-left-color: var(--warn)` + "Çelişki" rozeti
- Citation badge'ler inline: `<sup><a class="cite" href="#source-K1">[1]</a></sup>`
- Header'da "Asistan" + "Kaynaklar (3)" badge

### 2.3 ProgressBar (`<div class="progress">`)
- Çok adımlı: her segment bir karar (varsayılan 3, bilinmiyorsa indeterminate)
- Segmentli bar: 3 eşit parça, dolu olanlar `var(--gold)`, boş olanlar `var(--line)`
- Üstünde label: `<span class="progress-label">2/3 karar doğrulandı</span>`
- Stream event: `{type:"progress", current:N, total:M, label:"karar doğrulandı"}`
- indeterminate: bar pulse animasyonu (`@keyframes pulse 1.6s ease-in-out infinite`)

### 2.4 EmptyState (`<div class="empty-card">`)
- "Doğrulanabilir karar bulunamadı" başlığı
- Altında 1-2 öneri: "İfadeyi değiştirin", "Daireyi daraltın", "Tarih aralığı ekleyin"
- "Yeniden dene" düğmesi (composer'a odak verir)

### 2.5 ErrorCard (`<div class="error-card">`)
- Genel hata: kırmızı kenarlı, metin + "Tekrar dene" düğmesi
- Rate limit (429): amber kenarlı, "Bedesten çok sık istek aldı, 30 sn sonra tekrar deneyeceğim"
  + otomatik countdown + "Şimdi tekrar dene" düğmesi

### 2.6 Composer
- Auto-grow textarea (`max-height: 200px`, min 1 satır)
- App-shell bottom padding dinamik: `padding-bottom: calc(var(--composer-h, 90px) + var(--sp-4))`
  — composer büyüdükçe padding de büyür, içerik kapatılmaz
- Disabled state (busy): opacity + cursor

### 2.7 Topbar
- Sol: marka "İçtihat·"
- Sağ: tema toggle (☀/🌙) + "Yargıtay · Danıştay · BAM · Yerel" subtle hint
- Sticky top, yarı saydam `backdrop-filter: blur(8px)`

---

## 3. Erişilebilirlik

- **Skip link:** `a.skip-link` — "İçeriğe atla", odaklanınca görünür
- **`:focus-visible`** tüm interaktif: `.btn`, `.send`, `.text-button`, `.official-link`, `.cite`,
  `.source-toggle`, `.theme-toggle`, `.copy-btn`, `.empty-card .btn`
- **Citation badge** tıklanınca: `scrollIntoView({behavior:"smooth", block:"start"})` + hedef
  `tabindex="-1"` + `prefers-reduced-motion` saygısı
- **`aria-live="polite"`** status ve progress için
- **Kontrast:** `--muted` ≥ 4.5:1 (her iki temada), `--gold` paper üzerinde ≥ 4.5:1 (text olarak
  kullanılmıyor ama rozet metni olarak AA)
- **Klavye:** Tab ile sıralı; Esc modal/empty/error kapatır; Enter composer'da Enter = gönder
  (Shift+Enter satır)

---

## 4. Streaming Protokolü (UI bunu bekleyecek)

`app/api/chat/route.ts` yeni event'leri akıtır (araştırma mantığı değil, sadece tel):

| Event | Şema |
|---|---|
| `{type:"progress", current:N, total:M, label:"karar doğrulandı"}` | Her tool çağrısı öncesi |
| `{type:"sources", items:[{id, mahkeme, daire, esasNo, kararNo, tarih, title}]}` | `ictihat_ara` sonrası, eğer karar varsa |
| `{type:"answer", content, citations:[{marker:"[1]", sourceId}]}` | Final text yerine |
| `{type:"text", content}` | (mevcut, geriye uyumlu) |
| `{type:"tool", name, args}` | (mevcut) |
| `{type:"error", message, code?}` | (mevcut) — `code: "rate_limit"` eklendi |
| `{type:"done"}` | (mevcut) |

**Geçiş stratejisi:** Mevcut akış korunur. UI, `progress`/`sources`/`answer` eventlerini tercih eder;
gelmezse mevcut `tool`/`text` eventlerine düşer (mock fallback). Mock data toggle:
`?mock=1` URL param ile (geliştirme için). Mock data 1 kaynak + indeterminate progress + final answer.

---

## 5. Dosya Hedefleri

| Dosya | Değişiklik |
|---|---|
| `app/globals.css` | **Tamamen yeniden yazılır.** Tüm tokenlar, tema, breakpoint, tüm bileşen class'ları. |
| `app/layout.tsx` | `next/font/google` Inter, `<html lang="tr">` + `data-theme` init script |
| `app/api/chat/route.ts` | NDJSON şema genişletme (research logic yok) |
| `app/page.tsx` | **Tamamen yeniden yazılır.** Tüm yeni bileşenler tek dosyada (file çok büyümezse). |
| `lib/mock.ts` (yeni) | `?mock=1` için sahte kaynak + cevap akışı |
| `app/api/chat/route.ts` | mock parametre desteği eklenir (geçici) |

`lib/bedesten.ts`, `lib/cache.ts`, `lib/llm.ts` → **DOKUNULMAZ**.

---

## 6. Kabul Kriterleri (verifier için)

### 6.1 Görsel/işlevsel
- [ ] Login ekranı: orman yeşili başlık, gold aksan, paper zemin
- [ ] Welcome/empty: ortalanmış, yumuşak tipografi
- [ ] Tek kaynaklı cevap: 1 source card + inline citation
- [ ] Çoklu kaynaklı: source strip + varsa çelişki rozeti
- [ ] "Tam metin" açma: kopyala butonu, scroll-top butonu, ✕ kapat
- [ ] Empty state: "Doğrulanabilir karar bulunamadı" + öneriler + yeniden dene
- [ ] Error state: kırmızı kenarlı + tekrar dene
- [ ] Rate limit 429: amber + countdown + "Şimdi tekrar dene"

### 6.2 Responsive
- [ ] 375px: composer tam genişlik, kaynak kart içeriği sarar
- [ ] 720px: breakpoint eşik, padding değişimi görünmez (smooth)
- [ ] 1020px: topbar max-width aktif, içerik aynı genişlikte
- [ ] 1280px: aşırı genişliyor, içerik 720px'te sabit

### 6.3 Erişilebilirlik
- [ ] Tab ile tüm interaktif öğelere ulaşılır
- [ ] `:focus-visible` her interaktifte görünür
- [ ] Esc modal/empty/error kapatır
- [ ] Skip link Tab ilk öğesinde görünür
- [ ] `--muted` paper üzerinde kontrast ≥ 4.5:1
- [ ] `prefers-reduced-motion` smooth scroll ve pulse animasyonu kapatır
- [ ] Screen reader: status + progress `aria-live="polite"` ile okunur

### 6.4 Streaming
- [ ] `/api/chat?mock=1` ile mock akış çalışır
- [ ] progress eventleri UI'ı canlı günceller
- [ ] sources eventleri SourceCard'lara bağlanır
- [ ] answer eventinde citation marker'lar source'a linkler
- [ ] Mevcut tool/text eventleri geriye uyumlu (mock'suz akış bozulmaz)

---

## 7. Çalışma Sırası

1. **Stream A** (coder): `globals.css` + `layout.tsx` (tüm token/tema/bileşen stilleri + Inter)
2. **Stream B** (coder): `app/api/chat/route.ts` + `lib/mock.ts` (şema + mock)
3. **Stream C** (coder): `app/page.tsx` (tüm bileşenler + mantık)

A ve B paralel, C onlardan sonra başlar (UI onlara bağlı).

4. **Verifier X** (verifier): Erişilebilirlik + kontrast denetimi
5. **Verifier Y** (verifier): Responsive + cross-flow test (curl + statik html parse)

X ve Y paralel, üç stream bittikten sonra.
