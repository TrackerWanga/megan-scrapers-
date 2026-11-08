// Megan Scrapers — Cloudflare Workers entrypoint
import { ytsHandler } from "./scrapers/yts.js";
import { nyaaHandler } from "./scrapers/nyaa.js";
import { net9jaHandler } from "./scrapers/net9ja.js";
import { sportybetHandler } from "./scrapers/sportybet.js";
import { deezerHandler } from "./scrapers/deezer.js";
import { itunesHandler } from "./scrapers/itunes.js";

const SCRAPERS = {
  yts:       { handler: ytsHandler,       description: "YTS movie torrents",        safe: true, upstream: "yts.ag" },
  nyaa:      { handler: nyaaHandler,      description: "Nyaa anime torrents",        safe: true, upstream: "nyaa.si" },
  net9ja:    { handler: net9jaHandler,    description: "Net9ja Nollywood movies",    safe: true, upstream: "net9ja.tv" },
  sportybet: { handler: sportybetHandler, description: "SportyBet live sports odds", safe: true, upstream: "sportybet.com" },
  deezer:    { handler: deezerHandler,    description: "Deezer music search",        safe: true, upstream: "api.deezer.com" },
  itunes:    { handler: itunesHandler,    description: "iTunes music search",        safe: true, upstream: "itunes.apple.com" },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-scraper-key",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function wrap(env, scraper, result) {
  const meta = {
    source: env.SERVER_NAME || "Megan Scrapers",
    server: "Cloudflare Worker",
    scraper,
    worker_id: env.WORKER_ID || "TX141B",
    last_maintained: env.LAST_MAINTAINED || "2026-11-08T00:00:00.000Z",
    version: env.VERSION || "1.0.0",
  };
  if (result && typeof result === "object" && "success" in result) {
    return { ...result, ...meta, timestamp: result.timestamp || new Date().toISOString() };
  }
  return {
    statusCode: 200, success: true, ...meta,
    data: result, timestamp: new Date().toISOString(),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── HEALTH ──
    if (path === "/health") {
      return json({
        status: "ok",
        source: env.SERVER_NAME || "Megan Scrapers",
        server: "Cloudflare Worker",
        worker_id: env.WORKER_ID || "TX141B",
        version: env.VERSION || "1.0.0",
        last_maintained: env.LAST_MAINTAINED,
        runtime: "cloudflare-workers",
        scrapers: Object.entries(SCRAPERS).map(([key, s]) => ({
          name: key, description: s.description, safe: s.safe, upstream: s.upstream,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // ── ROOT ──
    if (path === "/" || path === "") {
      return json({
        name: env.SERVER_NAME || "Megan Scrapers",
        server: "Cloudflare Worker",
        worker_id: env.WORKER_ID || "TX141B",
        version: env.VERSION || "1.0.0",
        last_maintained: env.LAST_MAINTAINED,
        usage: "GET /scrape/:scraper?action=...&...",
        scrapers: Object.keys(SCRAPERS),
        timestamp: new Date().toISOString(),
      });
    }

    // ── SCRAPERS LIST ──
    if (path === "/scrapers") {
      return json({
        source: env.SERVER_NAME || "Megan Scrapers",
        server: "Cloudflare Worker",
        worker_id: env.WORKER_ID || "TX141B",
        last_maintained: env.LAST_MAINTAINED,
        scrapers: Object.entries(SCRAPERS).map(([key, s]) => ({
          name: key,
          description: s.description,
          safe: s.safe,
          upstream: s.upstream,
          endpoint: `/scrape/${key}`,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // ── SCRAPE ROUTER ──
    if (path.startsWith("/scrape/")) {
      const scraper = path.split("/")[2];
      const entry = SCRAPERS[scraper];

      if (!entry) {
        return json({
          statusCode: 404, success: false,
          source: env.SERVER_NAME || "Megan Scrapers",
          server: "Cloudflare Worker",
          worker_id: env.WORKER_ID || "TX141B",
          last_maintained: env.LAST_MAINTAINED,
          error: `Unknown scraper: ${scraper}`,
          available: Object.keys(SCRAPERS),
          timestamp: new Date().toISOString(),
        }, 404);
      }

      const start = Date.now();
      const query = Object.fromEntries(url.searchParams);

      try {
        const result = await entry.handler(query);
        const wrapped = wrap(env, scraper, result);
        wrapped.response_time_ms = Date.now() - start;
        return json(wrapped);
      } catch (err) {
        return json({
          statusCode: 500, success: false,
          source: env.SERVER_NAME || "Megan Scrapers",
          server: "Cloudflare Worker",
          scraper,
          worker_id: env.WORKER_ID || "TX141B",
          last_maintained: env.LAST_MAINTAINED,
          error: err.message || String(err),
          response_time_ms: Date.now() - start,
          timestamp: new Date().toISOString(),
        }, 500);
      }
    }

    // ── 404 ──
    return json({
      statusCode: 404, success: false,
      source: env.SERVER_NAME || "Megan Scrapers",
      server: "Cloudflare Worker",
      worker_id: env.WORKER_ID || "TX141B",
      last_maintained: env.LAST_MAINTAINED,
      error: `Route not found: ${method} ${path}`,
      hint: "Try GET / or GET /scrapers or GET /scrape/:scraper?action=...",
      timestamp: new Date().toISOString(),
    }, 404);
  },
};
