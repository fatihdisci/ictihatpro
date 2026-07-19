import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { clientAddress } from "@/lib/auth";
import { createMcpServer } from "@/lib/mcp";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 100_000) return Response.json({ error: "MCP isteği çok büyük" }, { status: 413, headers: CORS_HEADERS });

  if (request.method === "POST") {
    const limit = rateLimit(`mcp:${clientAddress(request)}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) {
      return Response.json(
        { error: "Saatlik MCP istek sınırı doldu" },
        { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return withCors(await transport.handleRequest(request));
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
