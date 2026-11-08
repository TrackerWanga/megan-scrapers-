import { robustJson } from "./_http.js";
// Net9ja / NetNaija scraper (WordPress REST API)
// Chain: WP post → SDM (dldownload.com.ng) → wildshare file page

const NP = "https://www.net9ja.tv";
const SDM_HOST = "dldownload.com.ng";
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

async function wp(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = `${path}${qs.toString() ? `?${qs}` : ""}`;
  const json = await robustJson([
    `https://www.net9ja.tv${suffix}`,
    `https://net9ja.tv${suffix}`,
  ], { timeout: 15000, retries: 2 });
  return json;
}

function stripHtml(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePost(post) {
  const html = post.content?.rendered || "";
  const title = post.title?.rendered || "";
  const sdmAll = [...new Set(
    (html.match(/https?:\/\/dldownload\.com\.ng\/sdm_downloads\/[^\s"'<>]+/gi) || [])
      .map((u) => u.replace(/&amp;/g, "&"))
  )];
  let poster = post.jetpack_featured_media_url || null;
  if (!poster) {
    const img = html.match(/src=["'](https:\/\/www\.net9ja\.tv\/wp-content\/uploads\/[^"']+)["']/i);
    if (img) poster = img[1];
  }
  const imdb = html.match(/imdb\.com\/title\/(tt\d+)/i)?.[1] || null;
  const tmdb = html.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i) || null;
  return {
    id: post.id, slug: post.slug,
    title: stripHtml(title), link: post.link, date: post.date,
    excerpt: stripHtml(post.excerpt?.rendered || "").slice(0, 300),
    poster, imdb_id: imdb,
    tmdb_type: tmdb?.[1] || null, tmdb_id: tmdb?.[2] || null,
    sdm_url: sdmAll[0] || null, sdm_urls: sdmAll, sdm_count: sdmAll.length,
  };
}

async function resolveSdm(sdmUrl) {
  if (!sdmUrl || !sdmUrl.includes(SDM_HOST)) {
    throw new Error("Invalid SDM url (need dldownload.com.ng)");
  }
  const res = await fetch(sdmUrl, {
    headers: { "User-Agent": UA, Accept: "text/html", Referer: NP + "/" },
    redirect: "follow",
  });
  const html = await res.text();
  const wild = html.match(/href=["'](https?:\/\/wildshare\.net\/[^"']+)["']/i)?.[1]
    || html.match(/(https?:\/\/wildshare\.net\/[a-f0-9]+\/[^\s"'<>]+)/i)?.[1] || null;
  return {
    sdm_url: sdmUrl, sdm_status: res.status,
    wildshare_url: wild || null,
    note: wild ? "File page OK (bytes may need wildshare login)" : "No wildshare link on SDM page",
  };
}

export async function net9jaHandler(query) {
  const action = String(query.action || "").toLowerCase();
  const page = String(query.page || "1");
  const perPage = String(Math.min(Math.max(Number(query.limit) || 10, 1), 50));

  try {
    if (action === "home") {
      const posts = await wp("/wp-json/wp/v2/posts", { page, per_page: perPage });
      return envelope(true, { count: posts.length, posts: posts.map(parsePost) });
    }

    if (action === "search") {
      const q = query.q || query.query;
      if (!q) throw new Error("Parameter 'q' required");
      const posts = await wp("/wp-json/wp/v2/posts", { search: q, page, per_page: perPage });
      return envelope(true, { query: q, count: posts.length, posts: posts.map(parsePost) });
    }

    if (action === "movies" || action === "series") {
      const catId = action === "movies" ? "3" : "27";
      const posts = await wp("/wp-json/wp/v2/posts", { categories: catId, page, per_page: perPage });
      return envelope(true, { category: action, count: posts.length, posts: posts.map(parsePost) });
    }

    if (action === "categories") {
      const cats = await wp("/wp-json/wp/v2/categories", { per_page: "50" });
      return envelope(true, {
        categories: cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, count: c.count })),
      });
    }

    if (action === "post") {
      const key = query.slug || query.id;
      if (!key) throw new Error("Parameter 'slug' or 'id' required");
      let post;
      if (/^\d+$/.test(key)) {
        post = await wp(`/wp-json/wp/v2/posts/${key}`);
      } else {
        const list = await wp("/wp-json/wp/v2/posts", { slug: key });
        post = list[0] || null;
      }
      if (!post) throw new Error("Post not found");
      return envelope(true, parsePost(post));
    }

    if (action === "resolve") {
      const key = query.slug || query.url || query.sdm_url;
      if (!key) throw new Error("Parameter 'slug', 'url', or 'sdm_url' required");
      let sdmUrl = null, meta = null;
      if (key.includes(SDM_HOST)) {
        sdmUrl = key;
      } else {
        let slug = key;
        const m = key.match(/net9ja\.tv\/([^/?#]+)/i);
        if (m) slug = m[1];
        let post;
        if (/^\d+$/.test(slug)) post = await wp(`/wp-json/wp/v2/posts/${slug}`);
        else {
          const list = await wp("/wp-json/wp/v2/posts", { slug });
          post = list[0] || null;
        }
        if (!post) throw new Error("Post not found");
        meta = parsePost(post);
        sdmUrl = meta.sdm_url;
      }
      if (!sdmUrl) throw new Error("No SDM link in post");
      const chain = await resolveSdm(sdmUrl);
      return envelope(true, { post: meta, ...chain });
    }

    throw new Error(`Unknown action: ${action}. Use: home, search, movies, series, categories, post, resolve`);
  } catch (e) {
    return envelope(false, e);
  }
}
