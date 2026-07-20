import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../lib/mcp";

const live = process.env.LIVE_BEDESTEN === "1";
const originalSecret = process.env.SESSION_SECRET;

type ToolResult = { structuredContent?: Record<string, unknown>; isError?: boolean };

describe.runIf(live)("MCP madde zinciri (canlı)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    if (originalSecret == null) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("mevzuat_ara → mevzuat_madde_listesi → mevzuat_madde_getir zinciri TMK m.166'yı getirir", async () => {
    const server = createMcpServer();
    const client = new Client({ name: "ictihat-live-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const search = (await client.callTool({
      name: "mevzuat_ara",
      arguments: { baslik: "Türk Medeni Kanunu", mevzuat_no: "4721", turler: ["KANUN"] },
    })) as ToolResult;
    expect(search.isError).toBeFalsy();

    const documents = search.structuredContent?.documents as Array<Record<string, string>>;
    const law = documents.find((document) => document.number === "4721");
    expect(law?.sourceToken).toBeTruthy();

    const list = (await client.callTool({
      name: "mevzuat_madde_listesi",
      arguments: { sourceToken: law!.sourceToken, madde_no: 166 },
    })) as ToolResult;
    expect(list.isError).toBeFalsy();
    expect(list.structuredContent?.totalArticles).toBeGreaterThan(1000);
    expect(list.structuredContent?.matchedArticles).toBe(1);

    const articles = list.structuredContent?.articles as Array<Record<string, unknown>>;
    expect(articles[0].maddeNo).toBe(166);
    expect(articles[0].bolum).toEqual(expect.arrayContaining([expect.stringMatching(/KİTAP|KISIM|BÖLÜM/i)]));

    const article = (await client.callTool({
      name: "mevzuat_madde_getir",
      arguments: { articleToken: articles[0].articleToken as string },
    })) as ToolResult;
    expect(article.isError).toBeFalsy();
    expect(article.structuredContent?.evidenceComplete).toBe(true);

    const metadata = article.structuredContent?.metadata as Record<string, unknown>;
    expect(metadata.maddeNo).toBe(166);
    expect(metadata.legislationNumber).toBe("4721");
    // Boşanmanın genel sebebi maddesi: metin kesitsiz ve doğru madde olmalı.
    expect(String(article.structuredContent?.text)).toMatch(/evlilik birliği/i);

    await client.close();
    await server.close();
  }, 180_000);

  it("başka mevzuatın belirteciyle alınan madde belirteci kabul edilmez", async () => {
    const server = createMcpServer();
    const client = new Client({ name: "ictihat-live-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    // Mevzuat belirteci madde aracında geçerli olmamalı: türler ayrıdır.
    const search = (await client.callTool({
      name: "mevzuat_ara",
      arguments: { baslik: "Türk Medeni Kanunu", mevzuat_no: "4721", turler: ["KANUN"] },
    })) as ToolResult;
    const documents = search.structuredContent?.documents as Array<Record<string, string>>;

    const wrong = (await client.callTool({
      name: "mevzuat_madde_getir",
      arguments: { articleToken: documents[0].sourceToken },
    })) as ToolResult;

    expect(wrong.isError).toBe(true);

    await client.close();
    await server.close();
  }, 120_000);
});
