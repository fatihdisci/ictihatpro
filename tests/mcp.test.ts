import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../lib/mcp";

const originalSecret = process.env.SESSION_SECRET;

describe("MCP sunucusu", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    if (originalSecret == null) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("karar ve mevzuatı birlikte araştıran beş salt-okunur hukuk aracını protokol üzerinden listeler", async () => {
    const server = createMcpServer();
    const client = new Client({ name: "ictihat-test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "ictihat_semantik_ara",
      "ictihat_ara",
      "ictihat_getir",
      "mevzuat_ara",
      "mevzuat_getir",
    ]);
    expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(client.getInstructions()).toContain("kullanıcı araç adını yazmasa bile önce bu sunucunun aracını kullan");
    const semanticTool = listed.tools.find((tool) => tool.name === "ictihat_semantik_ara");
    expect(semanticTool?.title).toBe("Karar ve mevzuat araştır");
    expect(JSON.stringify(semanticTool?.inputSchema)).toContain("MEVZUAT");
    expect(client.getInstructions()).toContain("sourceToken yalnızca araçlar arası teknik bir belirteçtir");
    await client.close();
    await server.close();
  });
});
