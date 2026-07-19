export type DecisionSource = {
  kind: "decision";
  id: string;
  documentId: string;
  court: string | null;
  chamber: string | null;
  esasNo: string | null;
  kararNo: string | null;
  date: string | null;
  sourceUrl: string;
  evidenceComplete: boolean;
  excerpt: string;
};

export type LegislationSource = {
  kind: "legislation";
  id: string;
  legislationId: string;
  number: string | null;
  name: string;
  type: string | null;
  series: string | null;
  officialGazetteDate: string | null;
  officialGazetteNumber: string | null;
  sourceUrl: string;
  evidenceComplete: boolean;
  excerpt: string;
};

export type Source = DecisionSource | LegislationSource;

export type ResearchSource = "YARGITAY" | "ISTINAF" | "DANISTAY" | "KYB" | "MEVZUAT";

export type Answer = {
  mode?: "analysis" | "sources";
  title: string;
  summary: string;
  summarySourceIds: string[];
  sections: Array<{ heading: string; text: string; sourceIds: string[] }>;
  limitations: string[];
  sources: Source[];
  searchedSources?: ResearchSource[];
};

export type Research = { question: string; answer: Answer };

export const SOURCE_OPTIONS: Array<{ id: ResearchSource; label: string; shortLabel: string }> = [
  { id: "YARGITAY", label: "Yargıtay kararları", shortLabel: "Yargıtay" },
  { id: "ISTINAF", label: "BAM hukuk kararları", shortLabel: "İstinaf" },
  { id: "DANISTAY", label: "Danıştay kararları", shortLabel: "Danıştay" },
  { id: "KYB", label: "Kanun yararına bozma kararları", shortLabel: "KYB" },
  { id: "MEVZUAT", label: "Resmî mevzuat", shortLabel: "Mevzuat" },
];

export const ALL_SOURCES: ResearchSource[] = SOURCE_OPTIONS.map((option) => option.id);

export type QuickSearch = {
  category: string;
  label: string;
  query: string;
  sources: readonly ResearchSource[];
};

// Hazır araştırmalar yazı alanını doldurmakla kalmaz; kart seçildiğinde bu
// kaynak kümeleriyle doğrudan çalışır. Böylece hem ilgili içtihat koleksiyonu
// hem resmî mevzuat her kalıpta varsayılan olarak açıktır.
const CIVIL_SOURCES = ["YARGITAY", "ISTINAF", "MEVZUAT"] as const;
const ADMINISTRATIVE_SOURCES = ["DANISTAY", "MEVZUAT"] as const;
const CRIMINAL_SOURCES = ["YARGITAY", "MEVZUAT"] as const;

export const QUICK_SEARCHES: readonly QuickSearch[] = [
  { category: "Kira", label: "İhtiyaç nedeniyle tahliye", query: "Konut ihtiyacı nedeniyle tahliye davasının şartları ve ispatı nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Kira", label: "Tahliye taahhüdünün geçerliliği", query: "Tahliye taahhütnamesinin geçerlilik şartları ve tahliye davasındaki etkisi nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Kira", label: "İki haklı ihtar", query: "İki haklı ihtar nedeniyle tahliye davasının şartları ve süreleri nasıl uygulanır?", sources: CIVIL_SOURCES },
  { category: "Kira", label: "Kira tespit davası", query: "Kira tespit davasında emsal kira bedeli ve hakkaniyet indirimi nasıl belirlenir?", sources: CIVIL_SOURCES },
  { category: "Kira", label: "Kira uyarlama davası", query: "Aşırı ifa güçlüğü nedeniyle kira bedelinin uyarlanması hangi koşullarda istenebilir?", sources: CIVIL_SOURCES },
  { category: "Kira", label: "Depozito iadesi", query: "Kira ilişkisinde depozitonun iadesi ve mahsup koşulları nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "Aile", label: "Boşanma · kusur ve tazminat", query: "Boşanma davasında kusur belirlemesi ile maddi ve manevi tazminat koşulları nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Aile", label: "Velayetin değiştirilmesi", query: "Velayetin değiştirilmesi davasında çocuğun üstün yararı hangi ölçütlerle değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Aile", label: "Yoksulluk nafakası", query: "Yoksulluk nafakasının artırılması veya kaldırılmasında hangi ölçütler dikkate alınır?", sources: CIVIL_SOURCES },
  { category: "Aile", label: "Mal rejimi · katılma alacağı", query: "Edinilmiş mallara katılma rejiminde katılma alacağı ve değer artış payı nasıl hesaplanır?", sources: CIVIL_SOURCES },
  { category: "Aile", label: "İştirak nafakası", query: "İştirak nafakasının belirlenmesinde çocuğun ihtiyaçları ve tarafların ekonomik durumu nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "İş", label: "İşe iade · geçerli fesih", query: "İşe iade davasında geçerli fesih ve ispat yükü hangi ölçütlerle değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "İş", label: "Kıdem ve ihbar tazminatı", query: "Kıdem ve ihbar tazminatında ücretin tespiti, faiz ve zamanaşımı nasıl uygulanır?", sources: CIVIL_SOURCES },
  { category: "İş", label: "Fazla çalışma alacağı", query: "Fazla çalışma alacağında ispat, tanık beyanı ve hesaplama nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "İş", label: "Yıllık izin ücreti", query: "Yıllık ücretli izin alacağı ve izin ücretinin ispatı nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "İş", label: "İş kazası tazminatı", query: "İş kazası nedeniyle maddi ve manevi tazminatta kusur, illiyet bağı ve hesaplama nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "İcra", label: "İtirazın iptali", query: "İtirazın iptali davasında icra inkâr tazminatının şartları nelerdir?", sources: CIVIL_SOURCES },
  { category: "İcra", label: "Menfi tespit ve istirdat", query: "Menfi tespit ve istirdat davasında borçlu olmadığının ispatı ve icra takibine etkisi nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "İcra", label: "İcra takibine itiraz", query: "İlamsız icra takibine itirazın sonuçları ve itirazın kaldırılması şartları nelerdir?", sources: CIVIL_SOURCES },
  { category: "İcra", label: "Tasarrufun iptali", query: "Tasarrufun iptali davasında aciz belgesi, borçlu ve üçüncü kişinin durumu nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "Miras", label: "Mirasın reddi", query: "Mirasın reddinde süre, hükmen ret ve mirasçının sorumluluğu nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Miras", label: "Muris muvazaası", query: "Muris muvazaası nedeniyle tapu iptal ve tescil davasında ispat ölçütleri nelerdir?", sources: CIVIL_SOURCES },
  { category: "Miras", label: "Tenkis davası", query: "Tenkis davasında saklı pay ihlali, tasarruf oranı ve denkleştirme nasıl hesaplanır?", sources: CIVIL_SOURCES },
  { category: "Miras", label: "Vasiyetnamenin iptali", query: "Vasiyetnamenin iptali davasında ehliyetsizlik, yanılma ve şekil şartları nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "Taşınmaz", label: "Ortaklığın giderilmesi", query: "Ortaklığın giderilmesi davasında aynen taksim ve satış koşulları nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Taşınmaz", label: "Tapu iptal ve tescil", query: "Tapu iptal ve tescil davasında yolsuz tescil ve ispat koşulları nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Taşınmaz", label: "Önalım hakkı", query: "Yasal önalım davasında satış bildirimi, süreler ve bedelin belirlenmesi nasıl uygulanır?", sources: CIVIL_SOURCES },

  { category: "Tüketici", label: "Ayıplı mal ve ayıp ihbarı", query: "Tacirler arası satımda ayıp ihbarının süresi ve şekli nasıl değerlendirilir?", sources: CIVIL_SOURCES },
  { category: "Tüketici", label: "Tüketici sözleşmesinden cayma", query: "Mesafeli tüketici sözleşmesinde cayma hakkı, istisnalar ve bedel iadesi nasıl uygulanır?", sources: CIVIL_SOURCES },
  { category: "Tüketici", label: "Tüketici hakem heyeti", query: "Tüketici hakem heyeti kararına itiraz ve tüketici uyuşmazlığında görev nasıl belirlenir?", sources: CIVIL_SOURCES },

  { category: "Tazminat", label: "Trafik kazası · değer kaybı", query: "Trafik kazası nedeniyle araç değer kaybı tazminatında hesaplama ve ispat nasıl yapılır?", sources: CIVIL_SOURCES },
  { category: "Tazminat", label: "Destekten yoksun kalma", query: "Ölüm nedeniyle destekten yoksun kalma tazminatında destek ilişkisi ve hesaplama nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "Ticaret", label: "Şirket yöneticisinin sorumluluğu", query: "Anonim şirket yönetim kurulu üyesinin sorumluluğu ve kusur değerlendirmesi nasıl yapılır?", sources: CIVIL_SOURCES },
  { category: "Ticaret", label: "Haksız rekabet", query: "Haksız rekabetin tespiti, men'i ve tazminat koşulları nasıl değerlendirilir?", sources: CIVIL_SOURCES },

  { category: "Ceza", label: "Hakaret suçu", query: "Hakaret suçunda aleniyet, isnat ve ifade özgürlüğü sınırı nasıl değerlendirilir?", sources: CRIMINAL_SOURCES },
  { category: "Ceza", label: "Kasten yaralama", query: "Kasten yaralama suçunda basit tıbbi müdahale, haksız tahrik ve nitelikli hâller nasıl değerlendirilir?", sources: CRIMINAL_SOURCES },

  { category: "İdare", label: "İptal davası ve süre", query: "İdari işlemin iptali davasında dava açma süresi, menfaat ihlali ve hukuka aykırılık nasıl değerlendirilir?", sources: ADMINISTRATIVE_SOURCES },
  { category: "İdare", label: "Yürütmenin durdurulması", query: "Yürütmenin durdurulması talebinde telafisi güç zarar ve açık hukuka aykırılık koşulları nasıl uygulanır?", sources: ADMINISTRATIVE_SOURCES },
] as const;
