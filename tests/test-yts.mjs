import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { ytsHandler } from "../scrapers/yts.js";

const tests = [
  ["latest", { action: "latest", limit: "3" }],
  ["search 'matrix'", { action: "search", q: "matrix", limit: "2" }],
  ["movie id=59406", { action: "movie", id: "59406" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ YTS: ${name} ═══`);
  const r = await ytsHandler(query);
  if (r.success) {
    const d = r.data;
    if (d.movies) console.log(`✅ ${d.movies.length} movies (total ${d.total}) — first: ${d.movies[0]?.title}`);
    else if (d.title) console.log(`✅ ${d.title} (${d.year}) — ${d.torrents?.length} torrents`);
    else console.log(`✅ Success`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
