import { afterEach, describe, expect, it, vi } from "vitest";
import { complete } from "../lib/deepseek";

const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey == null) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("DeepSeek araç çağrısı", () => {
  it("zorunlu ilk araç seçiminde thinking modunu kapatır", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ choices: [{ message: { role: "assistant", tool_calls: [] } }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await complete({
      messages: [{ role: "user", content: "ara" }],
      tools: [
        {
          type: "function",
          function: { name: "karar_ara", description: "ara", parameters: { type: "object" } },
        },
      ],
      toolChoice: { type: "function", function: { name: "karar_ara" } },
    });

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.tool_choice).toEqual({ type: "function", function: { name: "karar_ara" } });
    expect(sent.thinking).toEqual({ type: "disabled" });
  });

  it("otomatik araç seçiminde thinking ile çakışan tool_choice alanını göndermez", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ choices: [{ message: { role: "assistant", tool_calls: [] } }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await complete({
      messages: [{ role: "user", content: "ara" }],
      tools: [
        {
          type: "function",
          function: { name: "karar_ara", description: "ara", parameters: { type: "object" } },
        },
      ],
      toolChoice: "auto",
    });

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.tool_choice).toBeUndefined();
    expect(sent.thinking).toEqual({ type: "enabled" });
  });
});
