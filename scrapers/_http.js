const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function robustFetch(url, options = {}) {
  const urls = Array.isArray(url) ? url : [url];
  const { headers = {}, timeout = 15000, retries = 3, acceptJson = true } = options;

  let lastError = null;
  for (const target of urls) {
    for (let r = 0; r < retries; r++) {
      try {
        const res = await fetch(target, {
          headers: {
            "User-Agent": DEFAULT_UA,
            ...(acceptJson ? { Accept: "application/json" } : {}),
            ...headers,
          },
          signal: AbortSignal.timeout(timeout),
          redirect: "follow",
        });
        if (!res.ok) {
          // Retry on 5xx AND 429 (rate limit) with exponential backoff
          const retriable = res.status >= 500 || res.status === 429 || res.status === 408;
          if (retriable && r < retries - 1) {
            lastError = new Error(`HTTP ${res.status}`);
            // 429 needs longer backoff to clear rate limits
            const delay = res.status === 429 ? 1500 * Math.pow(2, r) : 400 * Math.pow(2, r);
            await sleep(delay);
            continue;
          }
          throw new Error(`HTTP ${res.status} from ${target}`);
        }
        return res;
      } catch (e) {
        lastError = e;
        if (r < retries - 1) await sleep(250 * Math.pow(2, r));
      }
    }
  }
  throw new Error(`All attempts failed. Last error: ${lastError?.message || lastError?.cause?.code || "unknown"}`);
}

export async function robustJson(url, options = {}) {
  const res = await robustFetch(url, options);
  return res.json();
}

export async function robustText(url, options = {}) {
  const res = await robustFetch(url, { acceptJson: false, ...options });
  return res.text();
}

export { DEFAULT_UA };
