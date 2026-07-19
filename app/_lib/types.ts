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

export type ResearchSource = "YARGITAY" | "ISTINAF" | "DANISTAY" | "YEREL" | "KYB" | "MEVZUAT";

export type Answer = {
  mode?: "analysis" | "sources";
  title: string;
  summary: string;
  summarySourceIds: string[];
  sections: Array<{ heading: string; text: string; sourceIds: string[] }>;
  limitations: string[];
  sources: Source[];
};

export type Research = { question: string; answer: Answer };

export const SOURCE_OPTIONS: Array<{ id: ResearchSource; label: string; shortLabel: string }> = [
  { id: "YARGITAY", label: "Yargıtay kararları", shortLabel: "Yargıtay" },
  { id: "ISTINAF", label: "BAM hukuk kararları", shortLabel: "İstinaf" },
  { id: "DANISTAY", label: "Danıştay kararları", shortLabel: "Danıştay" },
  { id: "YEREL", label: "Yerel hukuk mahkemesi kararları", shortLabel: "Yerel" },
  { id: "KYB", label: "Kanun yararına bozma kararları", shortLabel: "KYB" },
  { id: "MEVZUAT", label: "Resmî mevzuat", shortLabel: "Mevzuat" },
];

export const ALL_SOURCES: ResearchSource[] = SOURCE_OPTIONS.map((option) => option.id);

export const QUICK_SEARCHES = [
  { category: "İş", label: "İşe iade · geçerli fesih", query: "İşe iade davasında geçerli fesih ve ispat yükü hangi ölçütlerle değerlendirilir?" },
  { category: "İş", label: "Kıdem ve ihbar tazminatı", query: "Kıdem ve ihbar tazminatında ücretin tespiti, faiz ve zamanaşımı nasıl uygulanır?" },
  { category: "İş", label: "Fazla çalışma alacağı", query: "Fazla çalışma alacağında ispat, tanık beyanı ve hesaplama nasıl değerlendirilir?" },
  { category: "Kira", label: "İhtiyaç nedeniyle tahliye", query: "Konut ihtiyacı nedeniyle tahliye davasının şartları ve ispatı nasıl değerlendirilir?" },
  { category: "Kira", label: "Kira tespit davası", query: "Kira tespit davasında emsal kira bedeli ve hakkaniyet indirimi nasıl belirlenir?" },
  { category: "Aile", label: "Boşanma · kusur ve tazminat", query: "Boşanma davasında kusur belirlemesi ile maddi ve manevi tazminat koşulları nasıl değerlendirilir?" },
  { category: "Aile", label: "Velayetin değiştirilmesi", query: "Velayetin değiştirilmesi davasında çocuğun üstün yararı hangi ölçütlerle değerlendirilir?" },
  { category: "Aile", label: "Yoksulluk nafakası", query: "Yoksulluk nafakasının artırılması veya kaldırılmasında hangi ölçütler dikkate alınır?" },
  { category: "İcra", label: "İtirazın iptali", query: "İtirazın iptali davasında icra inkâr tazminatının şartları nelerdir?" },
  { category: "Tazminat", label: "Trafik kazası · değer kaybı", query: "Trafik kazası nedeniyle araç değer kaybı tazminatında hesaplama ve ispat nasıl yapılır?" },
  { category: "Ticaret", label: "Ayıplı mal ve ayıp ihbarı", query: "Tacirler arası satımda ayıp ihbarının süresi ve şekli nasıl değerlendirilir?" },
  { category: "Taşınmaz", label: "Ortaklığın giderilmesi", query: "Ortaklığın giderilmesi davasında aynen taksim ve satış koşulları nasıl değerlendirilir?" },
] as const;
