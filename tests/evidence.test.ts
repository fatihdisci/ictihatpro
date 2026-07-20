import { describe, expect, it } from "vitest";
import { paginateText } from "../lib/evidence";

describe("paginateText", () => {
  it("kısa metni tek sayfada bırakır", () => {
    expect(paginateText("kısa karar metni", 1000)).toEqual(["kısa karar metni"]);
  });

  it("sayfaları birleştirince orijinal metni eksiksiz verir", () => {
    const body = Array.from({ length: 400 }, (_, index) => `Satır ${index} hukukî gerekçe metni`).join("\n");
    const pages = paginateText(body, 500);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join("")).toBe(body);
  });

  it("mümkün olduğunca satır sonundan böler, cümle ortasından değil", () => {
    const body = Array.from({ length: 200 }, () => "a".repeat(40)).join("\n");
    const pages = paginateText(body, 400);

    // Son sayfa dışındaki her sayfa satır sonuyla bitmeli.
    for (const page of pages.slice(0, -1)) {
      expect(page.endsWith("\n")).toBe(true);
    }
  });

  it("satır sonu bulunamazsa sabit boyutta böler ve sonsuz döngüye girmez", () => {
    const body = "x".repeat(2500);
    const pages = paginateText(body, 1000);

    expect(pages.map((page) => page.length)).toEqual([1000, 1000, 500]);
    expect(pages.join("")).toBe(body);
  });
});
