import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { itunesHandler } from "../scrapers/itunes.js";

const tests = [
  ["search 'alone'", { action: "search", q: "alone", limit: "3" }],
  ["search 'burna boy last last'", { action: "search", q: "burna boy last last", limit: "2" }],
  ["albums 'lover taylor'", { action: "albums", q: "lover taylor swift", limit: "2" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ iTunes: ${name} ═══`);
  const r = await itunesHandler(query);
  if (r.success) {
    const d = r.data;
    const label = d.results?.[0]?.title || d.results?.[0]?.name || d.title || "success";
    console.log(`✅ ${d.count || 1} result(s) — first: ${label}`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
