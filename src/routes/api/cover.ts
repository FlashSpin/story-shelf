import { createFileRoute } from "@tanstack/react-router";
import { isProxyableCoverUrl } from "@/lib/cover-proxy";

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}

function upstreamError(status: number): Response {
  return new Response("Cover unavailable", {
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

  // Normalize to https; only allowlisted catalog hosts.
  if (target.protocol === "http:") target.protocol = "https:";
  if (target.protocol !== "https:") return badRequest("HTTPS only");
  if (!isProxyableCoverUrl(target.href)) return badRequest("Host not allowed");

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5",
        // Empty referrer: Open Library / archive.org serve fine without one;
        // avoids leaking our Vercel host as Referer into their logs.
        Referer: "",
        "User-Agent": "StoryShelfCoverProxy/1.0 (family book catalog)",
      },
    });
  } catch {
    return upstreamError(502);
  }

  if (!upstream.ok) return upstreamError(upstream.status);

  const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    return badRequest("Upstream was not an image");
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  if (buf.byteLength === 0) return upstreamError(502);
  if (buf.byteLength > MAX_BYTES) return badRequest("Image too large");

  // Prefer a concrete type old Safari understands.
  const type =
    contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
        ? "image/webp"
        : contentType.includes("gif")
          ? "image/gif"
          : "image/jpeg";

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.byteLength),
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
