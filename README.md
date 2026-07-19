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

Kendi alan adınız varsa ayrıca:

- `TRUSTED_ORIGIN=https://ictihat.sizinalanadiniz.com`

Vercel'de dosya sistemi kalıcı değildir. Bu nedenle yerel dosya önbelleği performans garantisi vermez; uygulama önbellek olmadan da çalışır.

Uygulama varsayılan olarak en fazla 8 araştırma turunda 3 doğrulanmış karar inceler. Daha kapsamlı ama daha yavaş araştırma için isteğe bağlı olarak `MAX_RESEARCH_TURNS`, `MAX_SOURCES` ve `MAX_EVIDENCE_CHARS` ortam değişkenlerini artırabilirsiniz.

Bedesten arama davranışına ilişkin canlıda doğrulanmış notlar:

- Arama alaka sırasıyla döner; sorguya tarih sıralaması eklenmez.
- `AND`, `OR`, `NOT`, parantez ve çift tırnak desteklenir; `*` içeren sorgular servis tarafından bütünüyle reddedildiği için sorgulardan ayıklanır.
- Eşleştirme morfolojiktir: `ipotek` araması `ipoteğin` geçen kararları da bulur.
- Kaynak kartındaki "Resmî sistem" linki kararın kendi sayfasına (`mevzuat.adalet.gov.tr/ictihat/<belgeNo>`) gider ve "Tam metin" düğmesi kararın sunucuda doğrulanan metnini uygulama içinde açar.

## ChatGPT MCP

Vercel kurulumu ayrıca `/api/mcp` adresinde dört salt-okunur araç sunar: doğrulanmış içtihat arama/getirme ve resmî mevzuat arama/getirme. ChatGPT/Codex masaüstü uygulamasıyla bağlantı, güvenlik modeli ve mahkeme kapsamının dürüst sınırları için [MCP.md](./MCP.md) dosyasına bakın.

Bedesten ve mevzuat istemci tasarımında incelenen MIT lisanslı açık kaynak projeler ve korunan lisans metni için [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) dosyasına bakın. Uygulama bu depolara çalışma zamanı bağımlılığı taşımaz.

## Gizlilik

- `DEEPSEEK_API_KEY` hiçbir istemci paketine eklenmez ve tarayıcıya gönderilmez.
- Anahtar yalnızca sunucudaki `/api/chat` işlemi DeepSeek'e istek gönderirken kullanılır.
- `.env.local` Git tarafından dışlanır.
- Uygulamada üçüncü taraf analiz veya izleme kodu yoktur.
- Vercel kullanırsanız secret değerleri Vercel altyapısında tutulur. Tamamen kendi cihazınızda tutmak istiyorsanız self-host seçeneğini kullanın.

## Önemli sınır

Bedesten gayriresmî ve değişebilen bir uçtur. Servisin kendi indeksinde ilgisiz sonuç veya bozuk metadata bulunabilir. Uygulama kimlik doğrulaması yapar, fakat bir kararın soruya hukukî olarak uygunluğunun nihai kontrolü kullanıcıya aittir.
