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
DEEPSEEK_MODEL_FAST=deepseek-v4-flash
APP_PASSWORD=uzun-ve-benzersiz-bir-parola
SESSION_SECRET=openssl-ile-uretilmis-en-az-32-karakterlik-deger
```

### Model katmanları

Uygulama DeepSeek'i üç ayrı işte kullanır ve bunlar aynı zorlukta değildir:

| İş | Katman | Muhakeme |
|---|---|---|
| Arama planı (soruyu Bedesten sorgusuna çevirir) | `DEEPSEEK_MODEL_FAST` | kapalı |
| Semantik yeniden sıralama (OpenRouter yoksa) | `DEEPSEEK_MODEL_FAST` | kapalı |
| Cevap sentezi (kullanıcıya görünen tek çıktı) | `DEEPSEEK_MODEL` | **açık** |

İlk iki çağrı dar şemalı ve tek doğru cevabı olan dönüştürmelerdir; ucuz katman
yeterlidir ve düşük gecikmesi Bedesten turunu erken başlatır. Sentez ise
kullanıcının gördüğü metni yazdığı için güçlü katmanda ve muhakeme açık çalışır.

Sağlayıcı muhakeme kipini zorunlu araç seçimiyle birlikte kabul etmez; bu
nedenle sentez isteğinde araç seçimi modele bırakılır. Sağlayıcı yine de
reddederse istek muhakeme kapatılarak bir kez yinelenir, o da olmazsa JSON
kipiyle onarım denemesi yapılır. Yani muhakeme desteklenmese bile araştırma
başarısız olmaz.

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

### Paylaşılan durum (Upstash) — Vercel'de önerilir

Sunucusuz ortamda her lambda örneği kendi belleğine sahiptir. Bu yüzden süreç
içi istek sayaçları ve önbellek örnekler arasında paylaşılmaz: "saatlik 60
istek" sınırı fiilen `60 × örnek sayısı` olur ve Bedesten'in ölçülen
30 saniyede 10 istek kotası aşılarak 429 alınır.

Vercel projesine Upstash Redis entegrasyonunu eklemek bu üç şeyi paylaşılır
hâle getirir: istek sınırları, Bedesten kotası ve indirilen belge önbelleği.

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Bu değişkenler tanımlı değilse uygulama süreç-içi belleğe düşer ve eskisi gibi
çalışır; tek süreçli self-host kurulumunda doğru davranış budur. Upstash'e
ulaşılamazsa istek engellenmez, yerel sayaca geri dönülür.

Bedesten paylaşılan kotası `BEDESTEN_SHARED_LIMIT` (varsayılan 8) ve
`BEDESTEN_SHARED_WINDOW_S` (varsayılan 30) ile ayarlanır.

### Bölge ve sağlık kontrolü

`vercel.json` dağıtımı `fra1` (Frankfurt) bölgesine sabitler. Bedesten
Türkiye'dedir ve bir araştırma turu çok sayıda sıralı istek yaptığı için
varsayılan ABD bölgesi belirgin gecikme ekler.

Aynı dosya `/api/health` ucunu günde bir kez çalıştıran bir cron tanımlar. Bu
uç Bedesten'in karar araması, mevzuat araması ve madde ağacı sözleşmesini
doğrular; şema değişirse 503 döner ve ayrıntı loglanır. `CRON_SECRET`
tanımlanırsa uç yalnızca `Authorization: Bearer <değer>` başlığıyla çağrılabilir.

Uygulama varsayılan olarak 20 aday kararın tam metnini doğrular; anlamsal ve kelime temelli elemeden geçen en fazla 6 kaynak (mevzuat dâhil) gösterilir. Aday havuzunu değiştirmek için `SEMANTIC_CANDIDATES`, gösterilen kaynak sayısını değiştirmek için `MAX_SOURCES` kullanılabilir.

Bedesten arama davranışına ilişkin canlıda doğrulanmış notlar:

- Arama alaka sırasıyla döner; sorguya tarih sıralaması eklenmez.
- `AND`, `OR`, `NOT`, parantez ve çift tırnak desteklenir; `*` içeren sorgular servis tarafından bütünüyle reddedildiği için sorgulardan ayıklanır.
- Eşleştirme morfolojiktir: `ipotek` araması `ipoteğin` geçen kararları da bulur.
- Kaynak kartındaki "Resmî sistem" linki kararın kendi sayfasına (`mevzuat.adalet.gov.tr/ictihat/<belgeNo>`) gider ve "Tam metin" düğmesi kararın sunucuda doğrulanan metnini uygulama içinde açar.

## ChatGPT MCP

Vercel kurulumu ayrıca `/api/mcp` adresinde yedi salt-okunur araç sunar. Doğal dildeki ana araştırma aracı seçilen karar kaynaklarını ve resmî mevzuatı tek çağrıda tarar; doğrulanmış kararları ile ilgili mevzuat maddelerini ayrı sonuç kümelerinde döndürür. Kesin filtreli karar araması ve ham mevzuat araması/getirme araçları da korunur. ChatGPT/Codex bağlantısı, güvenlik modeli ve mahkeme kapsamının dürüst sınırları için [MCP.md](./MCP.md) dosyasına bakın.

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
