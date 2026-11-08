// iTunes Search API — with Apple-like headers to avoid rate limits.

const BASE = "https://itunes.apple.com";
const USER_AGENTS = [
  "iTunes/12.12 (Windows; Microsoft Windows 10 x64)",
  "iTunes/12.11 (Macintosh; OS X 10.15.7)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
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

async function itunesGet(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

  const headers = {
    "User-Agent": pick(USER_AGENTS),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://music.apple.com",
    "Referer": "https://music.apple.com/",
  };

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
      return res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error("Failed after 3 attempts");
}

function mapSong(r) {
  return {
    itunes_id: r.trackId,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    album_id: r.collectionId,
    genre: r.primaryGenreName,
    duration_ms: r.trackTimeMillis,
    duration_formatted: r.trackTimeMillis
      ? `${Math.floor(r.trackTimeMillis / 60000)}:${String(Math.floor((r.trackTimeMillis % 60000) / 1000)).padStart(2, "0")}`
      : null,
    release_date: r.releaseDate,
    track_number: r.trackNumber,
    isrc: r.isrc || null,
    explicit: r.trackExplicitness === "explicit",
    artwork: r.artworkUrl100?.replace("100x100", "500x500") || null,
    artwork_big: r.artworkUrl100?.replace("100x100", "600x600") || null,
    preview_url: r.previewUrl || null,
    apple_music_url: r.trackViewUrl || null,
  };
}

export async function itunesHandler(query) {
  const action = String(query.action || "").toLowerCase();
  try {
    if (action === "search" || action === "songs") {
      const q = query.q || query.query || query.term;
      if (!q) throw new Error("Parameter 'q' required");
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
      const country = query.country || "US";
      const data = await itunesGet("/search", {
        term: q, media: "music", entity: "song", limit, country,
      });
      const songs = (data.results || []).map(mapSong);
      return envelope(true, { query: q, country, total: data.resultCount || 0, count: songs.length, results: songs });
    }
    throw new Error(`Unknown action: ${action}. Use: search`);
  } catch (e) {
    return envelope(false, e);
  }
}
