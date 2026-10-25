/* Accessibility check: runs axe-core on the home screen, the section lists, the Grown-ups page, the shop and every
   subject and game (as it first opens), and fails on any "serious" or "critical" problem (missing labels, names,
   roles, contrast...). It also checks the keyboard can reach and open things, and that the comfort settings
   (less motion, bigger buttons) apply and still fit a phone screen.
     npm install --no-save axe-core && node tests/a11y.mjs */
import { start } from "./serve.mjs";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(process.env.AXE_PATH || require.resolve("axe-core/axe.min.js"), "utf8");
const { BASE, browser, close } = await start();
const failures = [];
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on("pageerror", e => failures.push("page error: " + e.message));

async function scan(hash){
  await page.goto(BASE + hash, { waitUntil: "load" }); await page.waitForTimeout(350);
  // judge the settled page, not a frame of a pop-in animation
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.addScriptTag({ content: AXE });
  const bad = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations
    .filter(v => v.impact === "serious" || v.impact === "critical")
    .map(v => `${v.impact} ${v.id}: ${v.help} (${v.nodes.slice(0, 2).map(n => n.target.join(" ")).join(", ")})`));
  console.log(`${bad.length ? "FAIL" : "ok  "} ${hash}`);
  bad.forEach(b => { console.log("       " + b); failures.push(hash + " " + b); });
}

await page.goto(BASE, { waitUntil: "load" });
const apps = await page.evaluate(() => [...document.querySelectorAll("#homeView a.door")].length && Hub.appList().map(a => `#/${a.section}/${a.id}`));
for (const h of ["#/", "#/learning", "#/games", "#/grownups", "#/shop", ...apps]) await scan(h);

// the keyboard alone can get from the home screen into the Learning list
await page.goto(BASE, { waitUntil: "load" }); await page.waitForTimeout(200);
let reached = false;
for (let i = 0; i < 40 && !reached; i++) { await page.keyboard.press("Tab"); reached = await page.evaluate(() => document.activeElement && document.activeElement.matches("a.door.learning")); }
if (reached) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
const opened = reached && await page.evaluate(() => location.hash === "#/learning");
console.log(`${opened ? "ok  " : "FAIL"} the keyboard reaches and opens Learning`);
if (!opened) failures.push("keyboard: couldn't Tab to Learning and open it");

// comfort settings: they apply, and with bigger buttons nothing sticks out sideways on a phone
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await phone.newPage();
await p2.goto(BASE, { waitUntil: "load" });
await p2.evaluate(() => { Hub.setComfort("motion", true); Hub.setComfort("big", true); });
for (const h of ["#/", "#/games", "#/grownups", "#/shop", "#/games/raceoff", "#/learning/math"]) {
  await p2.goto(BASE + h); await p2.waitForTimeout(350);
  const r = await p2.evaluate(() => ({ cls: document.documentElement.className, wide: document.documentElement.scrollWidth > innerWidth + 2, small: [...document.querySelectorAll(".btn")].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).length }));
  const ok = /less-motion/.test(r.cls) && /big-buttons/.test(r.cls) && !r.wide && r.small === 0;
  console.log(`${ok ? "ok  " : "FAIL"} comfort settings on a phone: ${h}${ok ? "" : ` (${r.wide ? "sticks out sideways " : ""}${r.small ? r.small + " small buttons" : ""})`}`);
  if (!ok) failures.push("comfort " + h);
}
await phone.close();

await close();
if (failures.length) { console.log(`\n${failures.length} accessibility problem(s).`); process.exit(1); }
console.log("\nAccessibility: no serious problems.");
