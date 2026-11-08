import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import { ytsHandler } from "./scrapers/yts.js";
import { nyaaHandler } from "./scrapers/nyaa.js";
import { net9jaHandler } from "./scrapers/net9ja.js";
import { sportybetHandler } from "./scrapers/sportybet.js";
import { deezerHandler } from "./scrapers/deezer.js";
import { itunesHandler } from "./scrapers/itunes.js";

const VERSION = "1.0.0";
const WORKER_ID = process.env.WORKER_ID || "TX141B";
const SERVER_NAME = process.env.SERVER_NAME || "Megan Scrapers";
const STARTED_AT = new Date().toISOString();
const LAST_MAINTAINED = process.env.LAST_MAINTAINED || STARTED_AT;

const SCRAPERS = {
  yts:       { handler: ytsHandler,       description: "YTS movie torrents",        safe: true, upstream: "yts.ag" },
  nyaa:      { handler: nyaaHandler,      description: "Nyaa anime torrents",        safe: true, upstream: "nyaa.si" },
  net9ja:    { handler: net9jaHandler,    description: "Net9ja Nollywood movies",    safe: true, upstream: "net9ja.tv" },
  sportybet: { handler: sportybetHandler, description: "SportyBet live sports odds", safe: true, upstream: "sportybet.com" },
  deezer:    { handler: deezerHandler,    description: "Deezer music search",        safe: true, upstream: "api.deezer.com" },
  itunes:    { handler: itunesHandler,    description: "iTunes music search",        safe: true, upstream: "itunes.apple.com" },
};

function wrap(scraper, result) {
  const meta = {
    source: SERVER_NAME,
    server: "Megan Scrapers",
    scraper,
    worker_id: WORKER_ID,
    last_maintained: LAST_MAINTAINED,
    version: VERSION,
  };
  if (result && typeof result === "object" && "success" in result) {
    return { ...result, ...meta, timestamp: result.timestamp || new Date().toISOString() };
  }
  return {
    statusCode: 200, success: true, ...meta,
    data: result, timestamp: new Date().toISOString(),
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    source: SERVER_NAME,
    server: "Megan Scrapers",
    worker_id: WORKER_ID,
    version: VERSION,
    uptime_seconds: Math.floor((Date.now() - new Date(STARTED_AT).getTime()) / 1000),
    started_at: STARTED_AT,
    last_maintained: LAST_MAINTAINED,
    scrapers: Object.entries(SCRAPERS).map(([key, s]) => ({
      name: key, description: s.description, safe: s.safe, upstream: s.upstream,
    })),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: SERVER_NAME,
    server: "Megan Scrapers",
    worker_id: WORKER_ID,
    version: VERSION,
    last_maintained: LAST_MAINTAINED,
    usage: "GET /scrape/:scraper?action=...&...",
    scrapers: Object.keys(SCRAPERS),
    timestamp: new Date().toISOString(),
  });
});

app.get("/scrape/:scraper", async (req, res) => {
  const { scraper } = req.params;
  const entry = SCRAPERS[scraper];

  if (!entry) {
    return res.status(404).json({
      statusCode: 404, success: false,
      source: SERVER_NAME, server: "Megan Scrapers",
      worker_id: WORKER_ID, last_maintained: LAST_MAINTAINED,
      error: `Unknown scraper: ${scraper}`,
      available: Object.keys(SCRAPERS),
      timestamp: new Date().toISOString(),
    });
  }

  const start = Date.now();
  try {
    const result = await entry.handler(req.query);
    const wrapped = wrap(scraper, result);
    wrapped.response_time_ms = Date.now() - start;
    res.json(wrapped);
  } catch (err) {
    res.status(500).json({
      statusCode: 500, success: false,
      source: SERVER_NAME, server: "Megan Scrapers",
      scraper, worker_id: WORKER_ID, last_maintained: LAST_MAINTAINED,
      error: err.message || String(err),
      response_time_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/scrapers", (_req, res) => {
  res.json({
    source: SERVER_NAME, server: "Megan Scrapers",
    worker_id: WORKER_ID, last_maintained: LAST_MAINTAINED,
    scrapers: Object.entries(SCRAPERS).map(([key, s]) => ({
      name: key,
      description: s.description,
      safe: s.safe,
      upstream: s.upstream,
      endpoint: `/scrape/${key}`,
    })),
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    statusCode: 404, success: false,
    source: SERVER_NAME, server: "Megan Scrapers",
    worker_id: WORKER_ID, last_maintained: LAST_MAINTAINED,
    error: `Route not found: ${req.method} ${req.path}`,
    hint: "Try GET / or GET /scrapers or GET /scrape/:scraper?action=...",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Megan Scrapers on port " + PORT);
  console.log("  Worker ID: " + WORKER_ID);
  console.log("  Version:   " + VERSION);
  console.log("  Health:    http://localhost:" + PORT + "/health");
  console.log("  Scrapers:  " + Object.keys(SCRAPERS).join(", "));
});
