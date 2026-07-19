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

ChatGPT/Codex masaüstü uygulamasında `Settings → MCP servers → Add server` yolundan Streamable HTTP sunucusu eklenebilir. Bu proje için alanlar şöyledir:

1. **Ad:** `İçtihat ve Mevzuat Asistanı`
2. **Tür:** `Akış destekli HTTP`
3. **URL:** `https://VERCEL-ALAN-ADINIZ/api/mcp`
4. Taşıyıcı token, başlıklar ve ortam değişkenlerini ilk sürümde boş bırakın.
5. Kaydettikten sonra uygulamayı yeniden başlatın ve yeni bir görevde `/mcp` ile bağlantıyı doğrulayın.

Sunucu, doğal dildeki Türk hukuku sorularında araçlar adını anılmadan önce kullanılacak şekilde yönergeler yayımlar. Örneğin “Muvazaalı işlemde ispat yükü nasıl değerlendirilir?” doğrudan yazılabilir. Araç seçimi istemci modelinin kararı olduğundan yüzde yüz zorlayıcı bir anahtar yoktur; MCP bağlantısı etkin ve araçlar açık olmalıdır. Normal ChatGPT web/mobil sohbetleri ile masaüstü Codex MCP bağlantısı farklı ürün yüzeyleridir; birinde yapılan bağlantı diğerine kendiliğinden taşınmaz.
