# İçtihat Asistanı

DeepSeek V4 Pro ve Adalet Bakanlığı UYAP Bedesten karar servisini kullanan kişisel hukuk araştırma uygulaması.

## Neyi farklı yapar?

Bu uygulama LLM'in karar künyesi üretmesine izin vermez:

1. Model Bedesten'de arama yapar.
2. Kullanılacak kararın tam metni sunucuda indirilir.
3. Arama sonucundaki esas ve karar numaralarının tam metinde geçtiği kodla doğrulanır.
4. Bozuk tarihler (ör. `6006`) reddedilir ve tarih uydurulmaz.
5. Son cevap JSON olarak üretilir ve yalnızca sunucunun verdiği `K1`, `K2` gibi kaynak kimliklerini kullanabilir.
6. Kaynak kartlarındaki daire, esas, karar ve tarih bilgilerini model değil sunucu yazar.
7. Model doğrulanmamış bir kaynak kimliği veya karar numarası yazarsa cevap reddedilir.

Karar aramalarında ilk Bedesten sonuçlarının sınırlı bir bölümü tam metinden
doğrulanır ve kullanıcının cümlesine anlamsal yakınlığına göre yeniden
sıralanır. `OPENROUTER_API_KEY` tanımlıysa `google/gemini-embedding-001`
embedding modeli kullanılır; tanımlı değilse mevcut DeepSeek bağlantısı yalnızca
aday puanlayıcı olarak çalışır. Semantik katman hukukî cevap üretmez ve karar
künyesine müdahale etmez.

Bu önlemler karar künyesi uydurma riskini teknik olarak ciddi ölçüde azaltır. Hiçbir LLM hukukî yorum bakımından matematiksel doğruluk garantisi veremez; bu nedenle çıktı araştırma taslağı olarak sunulur.

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local
```

`.env.local` içine en az şunları yazın:

```dotenv
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-pro
APP_PASSWORD=uzun-ve-benzersiz-bir-parola
SESSION_SECRET=openssl-ile-uretilmis-en-az-32-karakterlik-deger
```

Oturum sırrı üretmek için:

```bash
openssl rand -hex 32
```

Ardından:

```bash
npm run dev
```

Tarayıcıdan `http://localhost:3000` adresine girin.

## Kontroller

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Gerçek Bedesten servisiyle isteğe bağlı uyumluluk testi:

```bash
LIVE_BEDESTEN=1 npm test -- tests/bedesten.live.test.ts
```

## Vercel

Proje normal bir Next.js uygulamasıdır. GitHub deposunu Vercel'e bağlayın ve Production, Preview ve Development ortamları için gerekli değişkenleri Vercel Project Settings → Environment Variables bölümünde tanımlayın.

Zorunlu değerler:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL=deepseek-v4-pro`
- `APP_PASSWORD`
- `SESSION_SECRET`

İsteğe bağlı gerçek embedding sıralaması:

- `OPENROUTER_API_KEY`
- `OPENROUTER_EMBEDDING_MODEL=google/gemini-embedding-001`

OpenRouter tanımlanmazsa semantik yeniden sıralama `DEEPSEEK_API_KEY` ile
çalışmaya devam eder. OpenRouter isteği başarısız olursa otomatik olarak
DeepSeek sıralamasına geçilir. `SEMANTIC_CANDIDATES` varsayılan olarak `20`,
`SEMANTIC_MIN_SCORE` ise `0.42` değerindedir.

Kendi alan adınız varsa ayrıca:

- `TRUSTED_ORIGIN=https://ictihat.sizinalanadiniz.com`

Vercel'de dosya sistemi kalıcı değildir. Bu nedenle yerel dosya önbelleği performans garantisi vermez; uygulama önbellek olmadan da çalışır.

Uygulama varsayılan olarak 20 aday kararın tam metnini doğrular; anlamsal ve kelime temelli elemeden geçen en fazla 6 kaynak (mevzuat dâhil) gösterilir. Aday havuzunu değiştirmek için `SEMANTIC_CANDIDATES`, gösterilen kaynak sayısını değiştirmek için `MAX_SOURCES` kullanılabilir.

Bedesten arama davranışına ilişkin canlıda doğrulanmış notlar:

- Arama alaka sırasıyla döner; sorguya tarih sıralaması eklenmez.
- `AND`, `OR`, `NOT`, parantez ve çift tırnak desteklenir; `*` içeren sorgular servis tarafından bütünüyle reddedildiği için sorgulardan ayıklanır.
- Eşleştirme morfolojiktir: `ipotek` araması `ipoteğin` geçen kararları da bulur.
- Kaynak kartındaki "Resmî sistem" linki kararın kendi sayfasına (`mevzuat.adalet.gov.tr/ictihat/<belgeNo>`) gider ve "Tam metin" düğmesi kararın sunucuda doğrulanan metnini uygulama içinde açar.

## ChatGPT MCP

Vercel kurulumu ayrıca `/api/mcp` adresinde beş salt-okunur araç sunar: normal ve semantik içtihat arama, doğrulanmış içtihat getirme ve resmî mevzuat arama/getirme. ChatGPT/Codex masaüstü uygulamasıyla bağlantı, güvenlik modeli ve mahkeme kapsamının dürüst sınırları için [MCP.md](./MCP.md) dosyasına bakın.

Bedesten ve mevzuat istemci tasarımında incelenen MIT lisanslı açık kaynak projeler ve korunan lisans metni için [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) dosyasına bakın. Uygulama bu depolara çalışma zamanı bağımlılığı taşımaz.

## Gizlilik

- `DEEPSEEK_API_KEY` hiçbir istemci paketine eklenmez ve tarayıcıya gönderilmez.
- Anahtar yalnızca sunucudaki `/api/chat` işlemi DeepSeek'e istek gönderirken kullanılır.
- Semantik sıralamada en fazla `SEMANTIC_CANDIDATES` adet doğrulanmış karar
  pasajı yapılandırılmış sıralama sağlayıcısına gönderilir. OpenRouter
  kullanılacaksa `OPENROUTER_API_KEY` de yalnızca sunucuda tutulur.
- `.env.local` Git tarafından dışlanır.
- Uygulamada üçüncü taraf analiz veya izleme kodu yoktur.
- Vercel kullanırsanız secret değerleri Vercel altyapısında tutulur. Tamamen kendi cihazınızda tutmak istiyorsanız self-host seçeneğini kullanın.

## Önemli sınır

Bedesten gayriresmî ve değişebilen bir uçtur. Servisin kendi indeksinde ilgisiz sonuç veya bozuk metadata bulunabilir. Uygulama kimlik doğrulaması yapar, fakat bir kararın soruya hukukî olarak uygunluğunun nihai kontrolü kullanıcıya aittir.
