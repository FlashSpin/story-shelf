import { createFileRoute } from "@tanstack/react-router";
import { fetchProxiedCover } from "@/lib/cover-proxy";

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}

function upstreamError(status: number, message = "Cover unavailable"): Response {
  return new Response(message, {
    status: status >= 400 && status < 600 ? status : 502,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}

async function handleCover(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return badRequest("Missing url");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return badRequest("Invalid url");
  }

  // Normalize to https before allowlist check inside fetchProxiedCover.
  if (target.protocol === "http:") target.protocol = "https:";
  if (target.protocol !== "https:") return badRequest("HTTPS only");

  const result = await fetchProxiedCover(target.href);

  if (!result.ok) {
    if (result.noStore || result.status === 400) {
      return badRequest(result.message);
    }
    return upstreamError(result.status, result.message);
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.body.byteLength),
      "Cache-Control": CACHE_CONTROL,
      // Same-origin <img> — CORS not required, but harmless for canvas/tools.
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/cover")({
  server: {
    handlers: {
      GET: ({ request }) => handleCover(request),
    },
  },
});
