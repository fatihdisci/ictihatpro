# ChatGPT MCP kurulumu

Bu proje Vercel üzerinde salt-okunur bir Streamable HTTP MCP sunucusu sağlar:

```text
https://ictihatpro.vercel.app/api/mcp
```

## Araçlar

- `ictihat_semantik_ara`: Doğal dilde araştırmayı tek çağrıda yürütür. Seçilen karar kaynaklarında doğrulanmış kararları ve `MEVZUAT` seçilmişse resmî metinden ilgili maddeleri ayrı dizilerde getirir. Varsayılan kapsamın tamamı açıktır: Yargıtay, Danıştay, BAM hukuk, kanun yararına bozma ve mevzuat.
- `ictihat_ara`: Kesin ifade, daire veya tarih filtreli aramalarda Yargıtay, Danıştay, BAM hukuk ve kanun yararına bozma kararlarını aday olarak arar.
- `ictihat_getir`: Yalnızca arama sonucunda sunucunun imzaladığı belirteçle kararı açar ve esas/karar numaralarını tam metinde doğrular.
- `mevzuat_ara`: Kanun, KHK, tüzük, yönetmelik, Cumhurbaşkanlığı düzenlemeleri, tebliğ ve mülga mevzuatta arama yapar.
- `mevzuat_getir`: Yalnızca arama sonucundaki imzalı belirteçle resmî mevzuat metnini getirir.
- `mevzuat_madde_listesi`: Mevzuatın resmî madde ağacını getirir. Madde numaraları ve başlıkları servisin verdiği veridir; metinden ayıklanmaz. `madde_no` veya `baslik_ara` ile daraltılır.
- `mevzuat_madde_getir`: Tek maddenin resmî metnini kesintisiz getirir; `gerekce=true` ile madde gerekçesini de döndürür.

### Madde erişimi neden ayrı

`mevzuat_getir` kanunun tamamını indirip odak sorusuna göre kesit üretir; uzun kanunlarda bu kesit eksik kalabilir ve madde sınırları metinden regex'le tahmin edilir. Belirli bir madde soruluyorsa (ör. "TMK 166") `mevzuat_ara → mevzuat_madde_listesi → mevzuat_madde_getir` sırası kullanılmalıdır: bu yolda madde numarası, başlığı ve kimliği resmî servisten gelir, metin kesintisizdir ve `evidenceComplete` her zaman `true` döner.

### Uzun belgelerde sayfalama

`ictihat_getir` ve `mevzuat_getir` varsayılan olarak odakla ilişkili bir kesit döndürür. Belge kesildiğinde `evidenceComplete=false` olur ve `totalPages` alanı belgenin kaç sayfa olduğunu bildirir. Tam metni sırayla okumak için aynı araç `sayfa=1, 2, …` ile tekrar çağrılır; sayfalar satır sonlarına yaslanır, cümle ortasından kesilmez. Sayfa boyutu `MCP_PAGE_CHARS` ile değiştirilebilir (varsayılan 25.000 karakter).

## Kapsam sınırı

Uygulama karar aramasında `YARGITAYKARARI`, `DANISTAYKARAR`, `ISTINAFHUKUK` ve `KYB` koleksiyonlarını kullanır; `YERELHUKUK` kapsamdan çıkarılmıştır. `ISTINAFHUKUK`, Bölge Adliye Mahkemelerinin hukuk kararlarını kapsar. Bölge Adliye Mahkemesi ceza kararları ile Bölge İdare Mahkemesi kararları bu entegrasyonda ayrı koleksiyon olarak bulunmaz. Bir Danıştay kararının içinde Bölge İdare Mahkemesi kararından söz edilmesi, o kararın ayrı tam metnine erişildiği anlamına gelmez.

## Güvenlik modeli

- Araçların tamamı salt-okunurdur ve kamuya açık Adalet Bakanlığı verisini sorgular.
- Arama sonucu tek başına kaynak kabul edilmez. Tam metin aracı için 30 dakika geçerli, HMAC imzalı bir kaynak belirteci gerekir.
- İmza anahtarı mevcut `SESSION_SECRET` değerinden ayrı bir bağlam etiketiyle türetilir.
- DeepSeek anahtarı MCP yanıtına veya ChatGPT'ye gönderilmez.
- Endpoint saatlik IP bazlı 60 MCP POST isteğiyle sınırlıdır.
- İlk kişisel prototip kimlik doğrulamasızdır. URL'yi bilen biri kamuya açık sorgu araçlarını çağırabilir; özel veri veya yazma aracı eklenmeden önce OAuth zorunlu kılınmalıdır.

## ChatGPT'de bağlama

Codex masaüstü uygulamasında `Settings → MCP servers → Add server` yolundan Streamable HTTP sunucusu eklenebilir. Bu proje için alanlar şöyledir:

1. **Ad:** `İçtihat ve Mevzuat Asistanı`
2. **Tür:** `Akış destekli HTTP`
3. **URL:** `https://ictihatpro.vercel.app/api/mcp`
4. Taşıyıcı token, başlıklar ve ortam değişkenlerini ilk sürümde boş bırakın.
5. Kaydettikten sonra uygulamayı yeniden başlatın ve yeni bir görevde `/mcp` ile bağlantıyı doğrulayın.

Sunucu, doğal dildeki Türk hukuku sorularında araçlar adını anılmadan önce kullanılacak şekilde yönergeler yayımlar. Örneğin “Muvazaalı işlemde ispat yükü için ilgili kararları ve kanun maddelerini getir” doğrudan yazılabilir. Araç seçimi istemci modelinin kararı olduğundan yüzde yüz zorlayıcı bir anahtar yoktur; MCP bağlantısı etkin ve araçlar açık olmalıdır. `sourceToken` yalnızca kararın veya mevzuatın uzun metnini açmak için araçlar arasında kullanılır; kullanıcıya gösterilmez.

ChatGPT webde özel MCP uygulaması kullanılıyorsa uygulamanın araç listesini yenileyin. Yeni bir sohbette uygulamayı seçin ve aynı doğal dildeki istemi kullanın. Araç tanımı güncellendiğinde ChatGPT, yeni şemayı ancak uygulamanın **Refresh/Yenile** işlemi sonrasında görür.
