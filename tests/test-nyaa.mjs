import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { nyaaHandler } from "../scrapers/nyaa.js";

const tests = [
  ["latest anime", { action: "latest" }],
  ["search 'naruto'", { action: "search", q: "naruto" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ Nyaa: ${name} ═══`);
  const r = await nyaaHandler(query);
  if (r.success) {
    console.log(`✅ ${r.data.count} results`);
    if (r.data.items?.[0]) console.log(`   First: ${r.data.items[0].title.slice(0, 60)}`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
