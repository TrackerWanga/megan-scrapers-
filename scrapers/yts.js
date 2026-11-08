// YTS movie scraper
import { robustJson } from "./_http.js";
// Public API: https://yts.mx/api/v2/

const BASE = (process.env.YTS_BASE || "https://yts.mx").replace(/\/$/, "");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

async function api(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffixes = `/api/v2${path}${qs.toString() ? `?${qs}` : ""}`;
  // Try multiple domains — Kenyan networks selectively block some
  const urls = [
    `https://yts.gg${suffixes}`,
    `https://yts.ag${suffixes}`,
    `https://yts.lt${suffixes}`,
    `https://yts.am${suffixes}`,
    `https://yts.mx${suffixes}`,
  ];
  const json = await robustJson(urls, { timeout: 15000, retries: 2 });
  if (json.status !== "ok") throw new Error(json.status_message || "YTS error");
  return json.data;
}

function magnetFromHash(hash, name) {
  const dn = encodeURIComponent(name || hash);
  const trackers = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://exodus.desync.com:6969/announce",
  ].map((t) => "&tr=" + encodeURIComponent(t)).join("");
  return `magnet:?xt=urn:btih:${hash}&dn=${dn}${trackers}`;
}

function normalizeMovie(m) {
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    year: m.year,
    rating: m.rating,
    runtime: m.runtime,
    language: m.language,
    genres: m.genres || [],
    summary: m.summary,
    imdb_code: m.imdb_code,
    poster: m.large_cover_image || m.medium_cover_image,
    background: m.background_image_original,
    yt_trailer: m.yt_trailer_code,
    torrents: (m.torrents || []).map((t) => ({
      quality: t.quality,
      type: t.type,
      size: t.size,
      size_bytes: t.size_bytes,
      seeds: t.seeds,
      peers: t.peers,
      hash: t.hash,
      magnet: magnetFromHash(t.hash, `${m.title} ${t.quality}`),
      url: t.url,
    })),
    url: m.url,
  };
}

export async function ytsHandler(query) {
  const action = String(query.action || "").toLowerCase();
  try {
    if (action === "latest") {
      const data = await api("/list_movies.json", {
        limit: query.limit || 20, page: query.page || 1,
        sort_by: query.sort_by || "date_added", order_by: query.order_by || "desc",
      });
      return envelope(true, {
        count: (data.movies || []).length,
        total: data.movie_count,
        page: data.page_number,
        movies: (data.movies || []).map(normalizeMovie),
      });
    }

    if (action === "search") {
      const q = query.q || query.query || query.query_term;
      if (!q) throw new Error("Parameter 'q' required");
      const data = await api("/list_movies.json", {
        query_term: q, limit: query.limit || 20, page: query.page || 1,
        quality: query.quality || undefined,
        minimum_rating: query.rating || undefined,
        genre: query.genre || undefined,
        sort_by: query.sort_by || "relevance",
      });
      return envelope(true, {
        query: q, count: (data.movies || []).length, total: data.movie_count,
        movies: (data.movies || []).map(normalizeMovie),
      });
    }

    if (action === "movie") {
      const id = query.id || query.movie_id;
      if (!id) throw new Error("Parameter 'id' required");
      const data = await api("/movie_details.json", {
        movie_id: id, with_images: "true", with_cast: "true",
      });
      return envelope(true, normalizeMovie(data.movie));
    }

    throw new Error(`Unknown action: ${action}. Use: latest, search, movie`);
  } catch (e) {
    return envelope(false, e);
  }
}
