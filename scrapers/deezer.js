// Deezer music scraper — public API: https://api.deezer.com
// No auth, no key required. Free for all users.

const BASE = "https://api.deezer.com";
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

async function deezerGet(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || `Deezer error ${json.error.code}`);
  return json;
}

function mapTrack(t) {
  return {
    id: t.id,
    title: t.title,
    title_short: t.title_short,
    artist: t.artist?.name,
    artist_id: t.artist?.id,
    artist_picture: t.artist?.picture_medium,
    album: t.album?.title,
    album_id: t.album?.id,
    duration: t.duration,
    duration_formatted: `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, "0")}`,
    explicit: t.explicit_lyrics,
    preview: t.preview, // 30-second MP3 preview (public, direct)
    link: t.link,
    thumbnail: t.album?.cover_medium,
    thumbnail_big: t.album?.cover_big,
  };
}

function mapAlbum(a) {
  return {
    id: a.id,
    title: a.title,
    artist: a.artist?.name,
    artist_id: a.artist?.id,
    cover: a.cover_medium,
    cover_big: a.cover_big,
    nb_tracks: a.nb_tracks,
    release_date: a.release_date,
    link: a.link,
    tracklist: a.tracklist,
  };
}

function mapArtist(a) {
  return {
    id: a.id,
    name: a.name,
    picture: a.picture_medium,
    picture_big: a.picture_big,
    nb_album: a.nb_album,
    nb_fan: a.nb_fan,
    link: a.link,
  };
}

export async function deezerHandler(query) {
  const action = String(query.action || "").toLowerCase();
  try {
    if (action === "search" || action === "s") {
      const q = query.q || query.query || query.term;
      if (!q) throw new Error("Parameter 'q' required");
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
      const data = await deezerGet("/search", { q, limit });
      return envelope(true, {
        query: q,
        total: data.total || 0,
        count: (data.data || []).length,
        results: (data.data || []).map(mapTrack),
      });
    }

    if (action === "track") {
      const id = query.id || query.track_id;
      if (!id) throw new Error("Parameter 'id' required");
      const data = await deezerGet(`/track/${id}`);
      return envelope(true, mapTrack(data));
    }

    if (action === "album") {
      const id = query.id || query.album_id;
      if (!id) throw new Error("Parameter 'id' required");
      const album = await deezerGet(`/album/${id}`);
      let tracks = [];
      try {
        const albumTracks = await deezerGet(`/album/${id}/tracks`, { limit: 100 });
        tracks = (albumTracks.data || []).map(mapTrack);
      } catch {}
      return envelope(true, {
        ...mapAlbum(album),
        tracks,
        track_count: tracks.length,
      });
    }

    if (action === "artist") {
      const id = query.id || query.artist_id;
      if (!id) throw new Error("Parameter 'id' required");
      const artist = await deezerGet(`/artist/${id}`);
      let topTracks = [];
      try {
        const top = await deezerGet(`/artist/${id}/top`, { limit: 10 });
        topTracks = (top.data || []).map(mapTrack);
      } catch {}
      return envelope(true, {
        ...mapArtist(artist),
        top_tracks: topTracks,
      });
    }

    if (action === "artist-search") {
      const q = query.q || query.query;
      if (!q) throw new Error("Parameter 'q' required");
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
      const data = await deezerGet("/search/artist", { q, limit });
      return envelope(true, {
        query: q,
        total: data.total || 0,
        count: (data.data || []).length,
        results: (data.data || []).map(mapArtist),
      });
    }

    if (action === "album-search") {
      const q = query.q || query.query;
      if (!q) throw new Error("Parameter 'q' required");
      const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
      const data = await deezerGet("/search/album", { q, limit });
      return envelope(true, {
        query: q,
        total: data.total || 0,
        count: (data.data || []).length,
        results: (data.data || []).map(mapAlbum),
      });
    }

    throw new Error(`Unknown action: ${action}. Use: search, track, album, artist, artist-search, album-search`);
  } catch (e) {
    return envelope(false, e);
  }
}
