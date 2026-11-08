// SportyBet sports betting scraper
// Public API: https://www.sportybet.com/api/{region}/...

const BASE = "https://www.sportybet.com/api";
const ORIGIN = "https://www.sportybet.com";
const REGIONS = ["ng", "gh", "ke", "tz", "zm", "ug", "cm", "za"];
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function envelope(ok, dataOrError) {
  if (ok) {
    return { statusCode: 200, success: true, source: "Megan Scrapers", data: dataOrError, timestamp: new Date().toISOString() };
  }
  return {
    statusCode: 500, success: false, source: "Megan Scrapers",
    error: typeof dataOrError === "string" ? dataOrError : dataOrError?.message || String(dataOrError),
    timestamp: new Date().toISOString(),
  };
}

function headers(region) {
  return {
    "User-Agent": pick(USER_AGENTS), Accept: "application/json",
    Origin: ORIGIN, Referer: `${ORIGIN}/${region}/`,
  };
}

function resolveRegion(input) {
  const r = String(input.region || input.country || "ng").toLowerCase();
  return REGIONS.includes(r) ? r : "ng";
}

function resolveSportId(input) {
  const raw = String(input.sportId || input.sport || "sr:sport:1").trim();
  if (raw.startsWith("sr:sport:")) return raw;
  const map = {
    football: "sr:sport:1", soccer: "sr:sport:1",
    basketball: "sr:sport:2", tennis: "sr:sport:5",
  };
  return map[raw.toLowerCase()] || raw;
}

async function apiGet(region, path, query = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}/${region}${path}${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", headers: headers(region) });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`HTTP ${res.status}`);
  if (json.bizCode && json.bizCode !== 10000) {
    throw new Error(json.message || json.innerMsg || `bizCode ${json.bizCode}`);
  }
  return json.data;
}

function mapOutcome(o) {
  return { id: o.id, desc: o.desc, odds: o.odds, active: o.isActive === 1 };
}

function mapMarket(m) {
  return {
    id: m.id, name: m.name || m.desc, status: m.status, group: m.group,
    outcomes: (m.outcomes || []).map(mapOutcome),
  };
}

function mapEvent(e, tournament) {
  const markets = (e.markets || []).map(mapMarket);
  const m1x2 = markets.find((m) => m.name === "1X2" || m.id === "1");
  return {
    eventId: e.eventId, gameId: e.gameId,
    home: e.homeTeamName, away: e.awayTeamName,
    score: e.setScore || null, period: e.period || null,
    matchStatus: e.matchStatus || null, playedSeconds: e.playedSeconds || null,
    status: e.status, startTime: e.estimateStartTime || null,
    tournament: tournament || e.sport?.category?.tournament?.name || null,
    category: e.sport?.category?.name || null,
    sport: e.sport?.name || null,
    totalMarkets: e.totalMarketSize || markets.length,
    odds1x2: m1x2 ? Object.fromEntries((m1x2.outcomes || []).map((o) => [
      o.desc === "Home" ? "1" : o.desc === "Draw" ? "X" : o.desc === "Away" ? "2" : o.desc, o.odds,
    ])) : null,
    markets: markets.slice(0, 8),
  };
}

function flattenTournaments(data, { limit = 40 } = {}) {
  const out = [];
  for (const t of data || []) {
    for (const e of t.events || []) {
      out.push(mapEvent(e, t.name));
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function sportybetHandler(query) {
  const action = String(query.action || "").toLowerCase();
  try {
    if (action === "sports") {
      const region = resolveRegion(query);
      const data = await apiGet(region, "/factsCenter/orderedSportList");
      return envelope(true, {
        region,
        sports: (data || []).map((s) => ({ id: s.id, name: s.name, eventSize: s.eventSize })),
      });
    }

    if (action === "live") {
      const region = resolveRegion(query);
      const sportId = resolveSportId(query);
      const pageSize = Math.min(50, Math.max(1, Number(query.limit) || 20));
      const data = await apiGet(region, "/factsCenter/liveOrPrematchEvents", { sportId, productId: 3, pageSize });
      const events = flattenTournaments(data, { limit: pageSize });
      const live = events.filter((e) => e.matchStatus || e.playedSeconds || e.score);
      return envelope(true, { region, sportId, mode: "live", count: live.length || events.length, events: live.length ? live : events });
    }

    if (action === "prematch") {
      const region = resolveRegion(query);
      const sportId = resolveSportId(query);
      const pageSize = Math.min(50, Math.max(1, Number(query.limit) || 20));
      const data = await apiGet(region, "/factsCenter/liveOrPrematchEvents", { sportId, productId: 1, pageSize });
      const events = flattenTournaments(data, { limit: pageSize });
      return envelope(true, { region, sportId, mode: "prematch", count: events.length, events });
    }

    if (action === "important") {
      const region = resolveRegion(query);
      const sportId = resolveSportId(query);
      const data = await apiGet(region, "/factsCenter/importantEvents", { sportId, productId: 3 });
      return envelope(true, {
        region, sportId,
        tournaments: (data || []).map((t) => ({
          id: t.id, name: t.name,
          events: (t.events || []).slice(0, 10).map((e) => mapEvent(e, t.name)),
        })),
      });
    }

    if (action === "event") {
      const region = resolveRegion(query);
      const eventId = query.eventId || query.id;
      if (!eventId) throw new Error("Parameter 'eventId' required");
      const sportId = resolveSportId(query);
      for (const productId of [3, 1]) {
        const data = await apiGet(region, "/factsCenter/liveOrPrematchEvents", { sportId, productId, pageSize: 50 });
        for (const t of data || []) {
          for (const e of t.events || []) {
            if (e.eventId === eventId || String(e.gameId) === String(eventId)) {
              return envelope(true, { region, found: true, event: mapEvent(e, t.name) });
            }
          }
        }
      }
      return envelope(true, { region, found: false, eventId });
    }

    if (action === "redblack_info" || action === "redblack") {
      return envelope(true, {
        game: "Red-Black", type: "info_only",
        rules: [
          "Choose RED or BLACK for the next card.",
          "Up to 5 turns per round.",
          "Deck: 52 cards plus green joker cards.",
          "Green joker is neither red nor black — that turn loses.",
          "Correct colour pays 2x the stake.",
        ],
      });
    }

    throw new Error(`Unknown action: ${action}. Use: sports, live, prematch, important, event, redblack_info`);
  } catch (e) {
    return envelope(false, e);
  }
}
