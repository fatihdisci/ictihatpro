import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete } from "../lib/deepseek";

const originalKey = process.env.DEEPSEEK_API_KEY;
const originalModel = process.env.DEEPSEEK_MODEL;
const originalFastModel = process.env.DEEPSEEK_MODEL_FAST;

const TOOL = {
  type: "function" as const,
  function: { name: "karar_ara", description: "ara", parameters: { type: "object" } },
};

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function ok() {
  return Response.json({ choices: [{ message: { role: "assistant", tool_calls: [] } }] });
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(String(fetchMock.mock.calls[call][1].body));
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  delete process.env.DEEPSEEK_MODEL;
  delete process.env.DEEPSEEK_MODEL_FAST;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey == null) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
  if (originalModel == null) delete process.env.DEEPSEEK_MODEL;
  else process.env.DEEPSEEK_MODEL = originalModel;
  if (originalFastModel == null) delete process.env.DEEPSEEK_MODEL_FAST;
  else process.env.DEEPSEEK_MODEL_FAST = originalFastModel;
});

describe("DeepSeek model katmanı", () => {
  it("varsayılan olarak pro modelini kullanır", async () => {
    const fetchMock = stubFetch(ok());

    await complete({ messages: [{ role: "user", content: "soru" }] });

    expect(sentBody(fetchMock).model).toBe("deepseek-v4-pro");
  });

  it("fast katmanında flash modelini kullanır", async () => {
    const fetchMock = stubFetch(ok());

    await complete({ messages: [{ role: "user", content: "soru" }], tier: "fast" });

    expect(sentBody(fetchMock).model).toBe("deepseek-v4-flash");
  });

  it("her iki katman da ortam değişkeniyle ezilebilir", async () => {
    process.env.DEEPSEEK_MODEL = "ozel-pro";
    process.env.DEEPSEEK_MODEL_FAST = "ozel-flash";
    const fetchMock = stubFetch(ok(), ok());

    await complete({ messages: [{ role: "user", content: "soru" }] });
    await complete({ messages: [{ role: "user", content: "soru" }], tier: "fast" });

    expect(sentBody(fetchMock, 0).model).toBe("ozel-pro");
    expect(sentBody(fetchMock, 1).model).toBe("ozel-flash");
  });
});

describe("DeepSeek muhakeme kipi", () => {
  it("araçlı çağrıda varsayılan olarak kapalıdır ve zorunlu araç seçimini gönderir", async () => {
    const fetchMock = stubFetch(ok());

    await complete({
      messages: [{ role: "user", content: "ara" }],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "karar_ara" } },
    });

    const sent = sentBody(fetchMock);
    expect(sent.thinking).toEqual({ type: "disabled" });
    expect(sent.tool_choice).toEqual({ type: "function", function: { name: "karar_ara" } });
  });

  it("araçsız çağrıda varsayılan olarak açıktır", async () => {
    const fetchMock = stubFetch(ok());

    await complete({ messages: [{ role: "user", content: "yaz" }], json: true });

    expect(sentBody(fetchMock).thinking).toEqual({ type: "enabled" });
  });

  it("açıkça istendiğinde araçlı çağrıda da açılır ve zorunlu seçimi düşürür", async () => {
    const fetchMock = stubFetch(ok());

    await complete({
      messages: [{ role: "user", content: "yaz" }],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "karar_ara" } },
      reasoning: true,
    });

    const sent = sentBody(fetchMock);
    expect(sent.thinking).toEqual({ type: "enabled" });
    // Sağlayıcı thinking ile zorunlu araç seçimini birlikte kabul etmez.
    expect(sent.tool_choice).toBeUndefined();
    expect(sent.tools).toHaveLength(1);
  });

  it("otomatik araç seçiminde tool_choice alanını hiç göndermez", async () => {
    const fetchMock = stubFetch(ok());

    await complete({
      messages: [{ role: "user", content: "ara" }],
      tools: [TOOL],
      toolChoice: "auto",
    });

    expect(sentBody(fetchMock).tool_choice).toBeUndefined();
  });
});

describe("DeepSeek muhakeme uyumsuzluğunda geri düşüş", () => {
  it("sağlayıcı thinking'i reddederse kapatıp yeniden dener", async () => {
    const fetchMock = stubFetch(
      new Response("thinking mode is not supported with this request", { status: 400 }),
      ok()
    );

    const message = await complete({
      messages: [{ role: "user", content: "yaz" }],
      reasoning: true,
    });

    expect(message.role).toBe("assistant");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 0).thinking).toEqual({ type: "enabled" });
    expect(sentBody(fetchMock, 1).thinking).toEqual({ type: "disabled" });
  });

  it("ilgisiz bir 400 hatasında yeniden denemez", async () => {
    const fetchMock = stubFetch(new Response("invalid api key", { status: 400 }));

    await expect(
      complete({ messages: [{ role: "user", content: "yaz" }], reasoning: true })
    ).rejects.toThrow(/invalid api key/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("muhakeme zaten kapalıysa yeniden denemez", async () => {
    const fetchMock = stubFetch(new Response("thinking conflict", { status: 400 }));

    await expect(
      complete({ messages: [{ role: "user", content: "ara" }], tools: [TOOL] })
    ).rejects.toThrow(/HTTP 400/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
