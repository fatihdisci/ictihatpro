# ChatGPT MCP kurulumu

Bu proje Vercel üzerinde salt-okunur bir Streamable HTTP MCP sunucusu sağlar:

```text
https://VERCEL-ALAN-ADINIZ/api/mcp
```

## Araçlar

- `ictihat_ara`: Yargıtay, Danıştay, yerel hukuk, BAM hukuk ve kanun yararına bozma kararlarında arama yapar.
- `ictihat_getir`: Yalnızca arama sonucunda sunucunun imzaladığı belirteçle kararı açar ve esas/karar numaralarını tam metinde doğrular.
- `mevzuat_ara`: Kanun, KHK, tüzük, yönetmelik, Cumhurbaşkanlığı düzenlemeleri, tebliğ ve mülga mevzuatta arama yapar.
- `mevzuat_getir`: Yalnızca arama sonucundaki imzalı belirteçle resmî mevzuat metnini getirir.

## Kapsam sınırı

Bedesten karar endpoint'inin mevcut koleksiyonları `YARGITAYKARARI`, `DANISTAYKARAR`, `YERELHUKUK`, `ISTINAFHUKUK` ve `KYB`'dir. `ISTINAFHUKUK`, Bölge Adliye Mahkemelerinin hukuk kararlarını kapsar. Bölge Adliye Mahkemesi ceza kararları ile Bölge İdare Mahkemesi kararları bu entegrasyonda ayrı koleksiyon olarak bulunmaz. Bir Danıştay kararının içinde Bölge İdare Mahkemesi kararından söz edilmesi, o kararın ayrı tam metnine erişildiği anlamına gelmez.

## Güvenlik modeli

- Araçların tamamı salt-okunurdur ve kamuya açık Adalet Bakanlığı verisini sorgular.
- Arama sonucu tek başına kaynak kabul edilmez. Tam metin aracı için 30 dakika geçerli, HMAC imzalı bir kaynak belirteci gerekir.
- İmza anahtarı mevcut `SESSION_SECRET` değerinden ayrı bir bağlam etiketiyle türetilir.
- DeepSeek anahtarı MCP yanıtına veya ChatGPT'ye gönderilmez.
- Endpoint saatlik IP bazlı 60 MCP POST isteğiyle sınırlıdır.
- İlk kişisel prototip kimlik doğrulamasızdır. URL'yi bilen biri kamuya açık sorgu araçlarını çağırabilir; özel veri veya yazma aracı eklenmeden önce OAuth zorunlu kılınmalıdır.

## ChatGPT'de bağlama

Güncel OpenAI desteğinde Pro kullanıcıları Developer Mode üzerinden salt-okunur MCP sunucuları bağlayabilir. Kurulum ChatGPT web arayüzünden yapılır:

1. `Settings → Apps → Advanced settings → Developer mode` seçeneğini açın.
2. `Settings → Apps → Create` bölümüne girin.
3. MCP URL'si olarak `https://VERCEL-ALAN-ADINIZ/api/mcp` yazın.
4. İlk sürüm için kimlik doğrulamasız bağlantıyı seçin.
5. `Scan tools` ile dört aracı taratıp uygulamayı oluşturun.
6. Yeni bir sohbette uygulamayı araç menüsünden seçin.

Plus planında özel MCP bağlantısı resmî olarak belirtilmemektedir. Sunucu Plus kullanırken geliştirilebilir ve bağımsız MCP istemcisiyle test edilebilir; ChatGPT içindeki bağlantı için Pro gerekir.
