import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { sportybetHandler } from "../scrapers/sportybet.js";

const tests = [
  ["sports list", { action: "sports", region: "ng" }],
  ["live football", { action: "live", region: "ng", sportId: "football", limit: "5" }],
  ["prematch", { action: "prematch", region: "ng", sportId: "basketball", limit: "3" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ SportyBet: ${name} ═══`);
  const r = await sportybetHandler(query);
  if (r.success) {
    if (r.data.sports) console.log(`✅ ${r.data.sports.length} sports`);
    else if (r.data.events) console.log(`✅ ${r.data.count} events`);
    else console.log(`✅ Success`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
