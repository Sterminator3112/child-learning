/* Smoke test: serves the app, opens every Learning subject and every game in a headless browser,
   presses Play where there is one, then plays a little (arrow keys, Space and a mouse drag on the game),
   and fails if any page throws an error. Then it opens everything again on a phone-sized screen and fails
   if anything sticks out sideways or a game's canvas runs off the bottom.
     node tests/smoke.mjs
   Needs Playwright with Chromium (npm install playwright && npx playwright install chromium). */
import { start } from "./serve.mjs";

const { BASE, browser, close } = await start();
const failures = [];

// a few seconds of button mashing: hold the arrows, tap Space, drag across the game with the mouse
async function playALittle(page){
  const canvas = page.locator(".game-screen:not([hidden]) canvas, .app-view:not([hidden]) canvas").first();
  for (const key of ["ArrowUp", "ArrowLeft", "Space", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.down(key); await page.waitForTimeout(80); await page.keyboard.up(key);
  }
  if (await canvas.count() && await canvas.isVisible()) {
    const r = await canvas.boundingBox();
    if (r) {
      await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.6); await page.mouse.down();
      await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.8, { steps: 6 }); await page.waitForTimeout(50);
      await page.mouse.up(); await page.waitForTimeout(200);
    }
  }
}

// a phone held upright: nothing may stick out sideways, and a game's canvas must fit on the screen
async function phoneCheck(hash, page, errors){
  errors.length = 0;
  await page.goto(BASE + hash);
  await page.waitForTimeout(250);
  const btn = page.locator(".game-screen:not([hidden]) .game-panel:not([hidden]) .btn").first();
  if (await btn.count() && await btn.isVisible()) {
    try { await btn.tap({ timeout: 10000 }); await page.waitForTimeout(200); }
    catch (e) { errors.push("the Play button can't be tapped (something covers it)"); }
  }
  const r = await page.evaluate(() => {
    const c = document.querySelector(".game-screen:not([hidden]) canvas"), b = c && c.getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - innerWidth, offBottom: b ? b.bottom - innerHeight : 0 };
  });
  if (r.over > 1) errors.push(`sticks out ${r.over}px sideways on a phone`);
  if (r.offBottom > 2) errors.push(`game runs ${Math.round(r.offBottom)}px off the bottom of a phone screen`);
  if (errors.length) failures.push(`${hash} (phone): ${[...new Set(errors)].join(" | ")}`);
}

// one page is reused for every visit: the app switches screens by the address, so there is no need to reload it
let shared = null, sharedErrors = [];
async function visit(hash, play){
  if (!shared) {
    shared = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    shared.on("pageerror", e => sharedErrors.push(e.message));
    shared.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) sharedErrors.push(m.text()); });
    await shared.goto(BASE, { waitUntil: "load" });
  }
  const page = shared, errors = sharedErrors;
  errors.length = 0;
  await page.goto(BASE + hash);
  await page.waitForTimeout(300);
  let links = [];
  if (play) {
    // press the Play button of the game's start panel, if it has one
    const btn = page.locator(".game-screen:not([hidden]) .game-panel:not([hidden]) .btn").first();
    if (await btn.count() && await btn.isVisible()) { await btn.click(); await page.waitForTimeout(500); }
    await playALittle(page);
  } else {
    links = await page.$$eval(`a[href^="${hash}/"]`, as => [...new Set(as.map(a => a.getAttribute("href")))]);
  }
  if (errors.length) failures.push(`${hash}: ${[...new Set(errors)].join(" | ")}`);
  return links;
}

const apps = [];
for (const section of ["#/learning", "#/games"]) apps.push(...await visit(section, false));
console.log(`Found ${apps.length} apps`);
if (apps.length < 10) failures.push(`only ${apps.length} apps were listed`);
for (const hash of apps) {
  await visit(hash, true);
  console.log(`${failures.some(f => f.startsWith(hash + ":")) ? "FAIL" : "ok  "} ${hash}`);
}

for (const p of ["#/grownups", "#/shop"]) {   // the Grown-ups page (report and backup) and the shop too
  await visit(p, false);
  console.log(`${failures.some(f => f.startsWith(p + ":")) ? "FAIL" : "ok  "} ${p}`);
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const phonePage = await phone.newPage();
const phoneErrors = [];
phonePage.on("pageerror", e => phoneErrors.push(e.message));
await phonePage.goto(BASE, { waitUntil: "load" });
for (const hash of ["#/", "#/learning", "#/games", "#/grownups", "#/shop", ...apps]) await phoneCheck(hash, phonePage, phoneErrors);
console.log(`${failures.some(f => f.includes("(phone)")) ? "FAIL" : "ok  "} everything fits on a phone`);
await phone.close();

await close();
if (failures.length) { console.error("\nErrors:\n" + failures.join("\n")); process.exit(1); }
console.log("\nAll apps opened without errors.");
