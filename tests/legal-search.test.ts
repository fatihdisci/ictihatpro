import { describe, expect, it } from "vitest";
import { relevantLegislationArticles } from "../lib/legal-search";

// Türk mevzuatında kenar başlığı ait olduğu maddeden ÖNCE gelir. TMK'nın
// önalım bölümünün gerçek yapısı budur.
const preemption = `**I. Taşınmaz mülkiyetinin kısıtlamaları**

**Madde 731-** Taşınmaz mülkiyetinin kanundan doğan kısıtlamaları, tapu siciline tescil edilmeksizin etkili olur.

Kamu yararı için konulan kısıtlamalar kaldırılamaz ve değiştirilemez.

**II. Devir hakkının kısıtlamaları**

**1\\. Yasal önalım hakkı**

**a. Önalım hakkı sahibi**

**Madde 732-** Paylı mülkiyette bir paydaşın taşınmaz üzerindeki payını üçüncü kişiye satması hâlinde, diğer paydaşlar önalım hakkını kullanabilirler.

**b. Kullanma yasağı, feragat ve hak düşürücü süre**

**Madde 733-** Yapılan satış, alıcı veya satıcı tarafından diğer paydaşlara noter aracılığıyla bildirilir. Önalım hakkı, satışın bildirildiği tarihin üzerinden üç ay ve her hâlde satışın üzerinden iki yıl geçmekle düşer.

**c. Kullanılması**

**Madde 734-** Önalım hakkı, alıcıya karşı dava açılarak kullanılır. Önalım hakkı sahibi, satış bedeli ile alıcıya düşen tapu giderlerini depo etmekle yükümlüdür.

**III. Saklı pay**

**Madde 506-** Saklı pay, altsoy için yasal miras payının yarısıdır.

**IV. Yasal temsilci**

**Madde 342-** Ana ve baba, velayetleri devam ettiği sürece çocuğun yasal temsilcisidirler.

**V. Yasal mirasçılar**

**Madde 495-** Miras bırakanın birinci derece yasal mirasçıları, onun altsoyudur.`;

describe("mevzuat madde seçimi", () => {
  it("kenar başlığını kendinden sonraki maddeye bağlar, öncekine değil", () => {
    // "Yasal önalım hakkı" başlığı 732'ye aittir. Yanlış atıfta 731 kazanır.
    const excerpt = relevantLegislationArticles(preemption, "yasal AND önalım", 1);

    expect(excerpt).toContain("Madde 732-");
    expect(excerpt).not.toContain("Madde 731-");
  });

  it("konuyu birlikte tanımlayan maddelerin tamamını döndürür", () => {
    // Bildirim (733), süre (733) ve bedel (734) ayrı maddelerdedir; tek veya
    // iki madde döndürmek soruyu eksik bırakır.
    const excerpt = relevantLegislationArticles(preemption, "yasal AND önalım");

    for (const article of ["Madde 732-", "Madde 733-", "Madde 734-"]) {
      expect(excerpt).toContain(article);
    }
    expect(excerpt).toContain("noter aracılığıyla");
    expect(excerpt).toContain("satış bedeli");
  });

  it("AND sorgusu yetersiz kalınca yalnızca ayırt edici terimle tamamlar", () => {
    // "yasal" kanunun her yerine dağılmış sık bir kelimedir; gevşetme buna
    // açılırsa saklı pay veya mirasçılık maddeleri sızar. Ayırt edici terim
    // az sayıda maddeye yoğunlaşan "önalım"dır.
    const excerpt = relevantLegislationArticles(preemption, "yasal AND önalım");

    for (const unrelated of ["Madde 506-", "Madde 342-", "Madde 495-"]) {
      expect(excerpt).not.toContain(unrelated);
    }
  });

  it("başlıksız düz metinde madde bölmeyi bozmaz", () => {
    const plain = `MADDE 10
Birinci maddenin metni burada yer alır ve kira sözleşmesini düzenler.

MADDE 11
İkinci maddenin metni tahliye koşullarını düzenler.`;

    const excerpt = relevantLegislationArticles(plain, "tahliye");

    expect(excerpt).toContain("MADDE 11");
    expect(excerpt).not.toContain("MADDE 10");
  });
});
