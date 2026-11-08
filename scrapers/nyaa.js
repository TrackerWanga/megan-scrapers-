// Nyaa.si anime torrent scraper — with browser-like headers to avoid rate limits.

const BASE = "https://nyaa.si";
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#34;/g, '"');
}

async function fetchRss({ q = "", category = "1_2", filter = "0" } = {}) {
  const params = new URLSearchParams({ page: "rss", q, c: category, f: filter });
  const url = `${BASE}/?${params}`;

  const headers = {
    "User-Agent": pick(USER_AGENTS),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://nyaa.si/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  // Retry with longer backoff for 429
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        lastErr = new Error(`HTTP 429 (rate limited)`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Failed after 3 attempts");
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const block of blocks) {
    const title = decodeHtml(
      (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i) || [])[1]
      || (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""
    ).trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]?.trim() || "";
    const guid = (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]?.trim() || "";
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]?.trim() || "";
    const seeders = (block.match(/<nyaa:seeders>(\d+)<\/nyaa:seeders>/i) || [])[1] || "0";
    const leechers = (block.match(/<nyaa:leechers>(\d+)<\/nyaa:leechers>/i) || [])[1] || "0";
    const downloads = (block.match(/<nyaa:downloads>(\d+)<\/nyaa:downloads>/i) || [])[1] || "0";
    const size = (block.match(/<nyaa:size>([\s\S]*?)<\/nyaa:size>/i) || [])[1]?.trim() || "";
    const categoryName = decodeHtml((block.match(/<nyaa:category>([\s\S]*?)<\/nyaa:category>/i) || [])[1] || "");
    const infoHash = (block.match(/<nyaa:infoHash>([\s\S]*?)<\/nyaa:infoHash>/i) || [])[1]?.trim() || "";
    let magnet = (block.match(/<nyaa:magnet><!\[CDATA\[([\s\S]*?)\]\]><\/nyaa:magnet>|<nyaa:magnet>([\s\S]*?)<\/nyaa:magnet>/i) || [])[1]
      || (block.match(/magnet:\?[^\s<]+/i) || [])[0] || "";
    magnet = decodeHtml(magnet);
    const idMatch = (link || guid).match(/\/view\/(\d+)/) || (link || guid).match(/\/download\/(\d+)/);
    const id = idMatch ? idMatch[1] : null;
    items.push({
      id, title,
      link: id ? `${BASE}/view/${id}` : link || guid,
      torrent: id ? `${BASE}/download/${id}.torrent` : null,
      magnet, infoHash, size,
      seeders: Number(seeders), leechers: Number(leechers), downloads: Number(downloads),
      category: categoryName, pubDate,
    });
  }
  return items;
}

export async function nyaaHandler(query) {
  const action = String(query.action || "").toLowerCase();
  const category = query.category || query.c || "1_2";
  const filter = query.filter || query.f || "0";
  try {
    if (action === "latest") {
      const xml = await fetchRss({ q: "", category, filter });
      const items = parseRss(xml);
      return envelope(true, { category, filter, count: items.length, items });
    }
    if (action === "search") {
      const q = query.q || query.query;
      if (!q) throw new Error("Parameter 'q' required");
      const xml = await fetchRss({ q, category, filter });
      const items = parseRss(xml);
      return envelope(true, { query: q, category, filter, count: items.length, items });
    }
    throw new Error(`Unknown action: ${action}. Use: latest, search`);
  } catch (e) {
    return envelope(false, e);
  }
}
