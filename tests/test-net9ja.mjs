import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { net9jaHandler } from "../scrapers/net9ja.js";

const tests = [
  ["home", { action: "home", limit: "3" }],
  ["categories", { action: "categories" }],
  ["search 'avengers'", { action: "search", q: "avengers", limit: "2" }],
];

for (const [name, query] of tests) {
  console.log(`\n═══ Net9ja: ${name} ═══`);
  const r = await net9jaHandler(query);
  if (r.success) {
    if (r.data.posts) console.log(`✅ ${r.data.count} posts — first: ${r.data.posts[0]?.title.slice(0, 60)}`);
    else if (r.data.categories) console.log(`✅ ${r.data.categories.length} categories`);
    else console.log(`✅ Success`);
  } else {
    console.log(`❌ ${r.error}`);
  }
}
