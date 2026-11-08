import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { deezerHandler } from "../scrapers/deezer.js";

const tests = [
  ["search 'alone'", { action: "search", q: "alone", limit: "3" }],
  ["track id=141822951", { action: "track", id: "141822951" }],
  ["artist 'Burna Boy'", { action: "artist-search", q: "burna boy", limit: "2" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ Deezer: ${name} ═══`);
  const r = await deezerHandler(query);
  if (r.success) {
    const d = r.data;
    if (d.results) {
      const first = d.results[0];
      const label = first?.title ? `${first.title} by ${first.artist}` : (first?.name || "unnamed");
      console.log(`✅ ${d.results.length} results — first: ${label}`);
    }
    else if (d.title) console.log(`✅ ${d.title} by ${d.artist} — preview: ${d.preview ? "yes" : "no"}`);
    else console.log(`✅ Success`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
