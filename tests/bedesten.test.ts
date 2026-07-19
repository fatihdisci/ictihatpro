import { afterEach, describe, expect, it, vi } from "vitest";
import {
  plausibleDecisionDate,
  searchDecisions,
  verifyDecisionDocument,
  type DecisionSummary,
} from "../lib/bedesten";
import { resolveChamber } from "../lib/chambers";
import { BedestenRateLimitError } from "../lib/bedesten-http";

const summary: DecisionSummary = {
  documentId: "123456",
  court: "Yargıtay Kararı",
  chamber: "9. Hukuk Dairesi",
  esasNo: "2023/1234",
  kararNo: "2024/5678",
  date: "12.03.2024",
  finalization: null,
};

describe("Bedesten metadata korumaları", () => {
  it("daire kısa kodlarını tam birim adına çevirir", () => {
    expect(resolveChamber("H9")).toBe("9. Hukuk Dairesi");
    expect(resolveChamber("iddk")).toBe("İdare Dava Daireleri Kurulu");
    expect(resolveChamber("Ankara Bölge Adliye Mahkemesi 1. Hukuk Dairesi")).toBe(
      "Ankara Bölge Adliye Mahkemesi 1. Hukuk Dairesi"
    );
  });

  it("makul tarihleri tek biçime çevirir", () => {
    expect(plausibleDecisionDate("12.03.2024")).toBe("12.03.2024");
    expect(plausibleDecisionDate("2024-03-12T00:00:00Z")).toBe("12.03.2024");
  });

  it("bozuk ve gelecekteki tarihleri reddeder", () => {
    expect(plausibleDecisionDate("21.09.6006")).toBeNull();
    expect(plausibleDecisionDate("tarih yok")).toBeNull();
  });

  it("esas ve karar numaraları metinde yoksa kararı reddeder", () => {
    expect(verifyDecisionDocument(summary, "x".repeat(500)).verified).toBe(false);
  });

  it("esas ve karar numaraları metinde birlikteyse kararı doğrular", () => {
    const body = `Yargıtay 9. Hukuk Dairesi 2023/1234 E. 2024/5678 K.\n${"Gerekçe. ".repeat(80)}`;
    expect(verifyDecisionDocument(summary, body)).toEqual({ verified: true });
  });
});

describe("Bedesten arama isteği", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Bedesten'in reddettiği karakterleri temizler ve alaka sıralamasını bozmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ metadata: { FMTY: "SUCCESS" }, data: { total: 0, emsalKararList: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDecisions({ phrase: 'ipotek* AND "türk lirası" — kaldırılması!', court: "HEPSI" });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    // `*` gibi karakterler sorgunun tamamının reddine yol açar; tarih sıralaması
    // ise ilgisiz güncel kararları öne aldığı için varsayılan (alaka) kullanılır.
    expect(payload.data.phrase).toBe('ipotek AND "türk lirası" kaldırılması');
    expect(payload.data.sortFields).toBeUndefined();
    expect(payload.data.sortDirection).toBeUndefined();
  });

  it("Yargıtay ve istinaf birlikte seçildiğinde yalnızca bu iki koleksiyonu yollar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ metadata: { FMTY: "SUCCESS" }, data: { total: 0, emsalKararList: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDecisions({ phrase: "işe iade", court: "YARGITAY_ISTINAF" });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.data.itemTypeList).toEqual(["YARGITAYKARARI", "ISTINAFHUKUK"]);
  });

  it("seçilen Danıştay, yerel hukuk ve kanun yararına bozma koleksiyonlarını aynen yollar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ metadata: { FMTY: "SUCCESS" }, data: { total: 0, emsalKararList: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDecisions({
      phrase: "muvazaa",
      court: "YARGITAY",
      courtTypes: ["DANISTAYKARAR", "YERELHUKUK", "KYB"],
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.data.itemTypeList).toEqual(["DANISTAYKARAR", "YERELHUKUK", "KYB"]);
  });

  it("aynı anda gelen özdeş Bedesten aramalarını tek ağ isteğinde birleştirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ metadata: { FMTY: "SUCCESS" }, data: { total: 0, emsalKararList: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      searchDecisions({ phrase: "muris muvazaası", court: "YARGITAY" }),
      searchDecisions({ phrase: "muris muvazaası", court: "YARGITAY" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sunucunun 429 yanıtını sonuç yok gibi gizlemek yerine yeniden deneme süresiyle bildirir", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "12" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchDecisions({ phrase: "muris muvazaası", court: "YARGITAY" })).rejects.toMatchObject({
      name: "BedestenRateLimitError",
      retryAfterSeconds: 13,
    } satisfies Partial<BedestenRateLimitError>);
  });
});
