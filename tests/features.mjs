/* Checks the family features: players (each with their own progress), the 💬 play-test notes in a game,
   and the backup code carrying every player to a fresh device.
     node tests/features.mjs */
import { start } from "./serve.mjs";

const { BASE, browser, close } = await start();
const failures = [], errors = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures.push(what); };

const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => d.accept(d.type() === "prompt" ? page.__answer || "" : undefined));
await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(300);

// player one gets a name and some coins
await page.fill("#kidName", "Leo");
await page.evaluate(() => { Hub.store.coins = 123; Hub.saveStore(); });
check(await page.locator(".profile-chip.on").innerText() === "🦊 Leo", "the first player is named on the home screen");

// a second player starts empty, and switching back brings player one's progress back
page.__answer = "Mia";
await Promise.all([page.waitForEvent("load"), page.click(".profile-chip.add")]);
await page.waitForTimeout(300);
check(await page.evaluate(() => Hub.Profiles.active().name) === "Mia", "a new player can be added and is switched to");
check(await page.evaluate(() => !Hub.store.coins || Hub.store.coins !== 123), "the new player has their own progress");
await page.evaluate(() => { Hub.store.coins = 7; Hub.saveStore(); });
await Promise.all([page.waitForEvent("load"), page.click(".profile-chip:not(.on):not(.add)")]);
await page.waitForTimeout(300);
check(await page.evaluate(() => Hub.store.coins) === 123 && await page.evaluate(() => Hub.Profiles.active().name) === "Leo", "switching back brings the first player's progress back");

// Robo is always on the home screen: before the tour, after it, and again after ✕ on the next visit
const robo = () => page.evaluate(() => { const b = document.querySelector(".tour-banner"); return b && !b.hidden ? b.textContent : ""; });
await page.goto(BASE); await page.waitForTimeout(300);
await page.evaluate(() => localStorage.removeItem("lp-tour-seen")); await page.reload(); await page.waitForTimeout(300);
check((await robo()).includes("New here"), "Robo welcomes a first-time visitor on the home screen");
await page.evaluate(() => localStorage.setItem("lp-tour-seen", "1")); await page.reload(); await page.waitForTimeout(300);
check((await robo()).includes("Meet the apps"), "Robo stays on the home screen after the tour was seen");
await page.click(".tour-banner-x");
check(!(await robo()), "✕ hides Robo for now");
await page.reload(); await page.waitForTimeout(300);
check(!!(await robo()), "Robo is back on the next visit");

// a play-test note from inside a game
await page.goto(BASE + "#/games/raceoff"); await page.waitForTimeout(400);
check(await page.locator("#roOverlay .fb-btn").count() === 1, "the 💬 button is in the game's top bar");
await page.click("#roOverlay .fb-btn");
await page.click('.fb-kind[data-kind="hard"]');
await page.fill(".fb-text", "level 6 jump is too long");
await page.keyboard.press("Space");   // typing must not drive the game underneath
await page.click(".fb-save");
check(await page.evaluate(() => Feedback.all().length === 1 && Feedback.all()[0].kind === "hard" && Feedback.all()[0].title === "Race Off"), "the note is saved with the game and what it was");
check(await page.evaluate(() => /Race Off · 😣 Too hard: level 6 jump is too long \(Leo\)/.test(Feedback.asText())), "the notes copy out as plain text");
await page.goto(BASE + "#/grownups"); await page.waitForTimeout(300);
check((await page.locator("#guNotes").innerText()).includes("level 6 jump is too long"), "the Grown-ups page lists the note");
check((await page.locator("#guPlayers").innerText()).includes("Mia"), "the Grown-ups page lists both players");

// study stars: right answers in Learning earn stars, which swap for coins and unlock Race Off's Brainiac
await page.goto(BASE); await page.waitForTimeout(200);
await page.evaluate(() => {
  const s = Notebook.subjects[0], t = Object.keys(s.data.topics)[0];
  s.data.topics[t].attempted = 260; s.data.topics[t].correct = 250;     // 25 stars
  const d = new Date(), day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  s.data.log = s.data.log || {}; s.data.log[day] = { a: 12, c: 11 };     // enough right answers today for the boost
  Hub.store.timeLog = { [day]: { learning: 900, games: 1800 } };
  Hub.saveStore();
});
check(await page.evaluate(() => Study.earned() === 25 && Study.boost()), "right answers earn study stars and turn on the study boost");
await page.goto(BASE + "#/shop"); await page.waitForTimeout(300);
const coinsBefore = await page.evaluate(() => Hub.store.coins);
await page.click('button[data-stars="1"]');
check(await page.evaluate(c => Hub.store.coins === c + 20 && Study.balance() === 24, coinsBefore), "a study star swaps for 20 coins in the shop");
await page.goto(BASE + "#/games/raceoff"); await page.waitForTimeout(300);
await page.click('[data-tab="garage"]'); await page.click('[data-car="brain"]'); await page.click("[data-starcar]");
check(await page.evaluate(() => __ro.R().owned.brain === true && __ro.R().car === "brain" && Study.balance() === 4), "20 study stars unlock the Brainiac car");
await page.evaluate(() => __ro.endless());
await page.waitForFunction(() => __ro.state === "race", null, { timeout: 15000 });
await page.evaluate(() => { __ro.car.head = true; }); await page.waitForTimeout(400);
check(await page.evaluate(() => __ro.stats && __ro.stats.boosted === true), "the study boost pays x1.5 coins in Race Off");
await page.goto(BASE + "#/grownups"); await page.waitForTimeout(300);
const week = await page.locator("#guWeek").innerText();
check(week.includes("Leo") && week.includes("Mia") && week.includes("15 min") && week.includes("30 min"), "the weekly summary lists every player with learning and game time");

// the backup code carries both players to a fresh browser
await page.click("#guMake");
await page.waitForFunction(() => document.getElementById("guCode").value.length > 10);
const code = await page.inputValue("#guCode");
const leoCoins = await page.evaluate(() => Hub.store.coins);
const fresh = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const p2 = await fresh.newPage();
p2.on("pageerror", e => errors.push(e.message));
p2.on("dialog", d => d.accept());
await p2.goto(BASE + "#/grownups"); await p2.waitForTimeout(300);
await p2.fill("#guPaste", code);
await Promise.all([p2.waitForEvent("load"), p2.click("#guRestore")]);
await p2.waitForTimeout(400);
const restored = await p2.evaluate(() => ({ names: Hub.Profiles.data().list.map(p => p.name), coins: Hub.store.coins, mia: JSON.parse(localStorage.getItem(Hub.Profiles.keyOf(Hub.Profiles.data().list[1].id))).coins }));
check(restored.names.join() === "Leo,Mia" && restored.coins === leoCoins && restored.mia === 7, "a backup code restores every player and their progress");

// offline: once the service worker has kept its copies, a game never opened before still starts with no network
const off = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const p3 = await off.newPage();
p3.on("pageerror", e => errors.push(e.message));
await p3.goto(BASE, { waitUntil: "load" });
await p3.evaluate(async () => { await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 1500)); });
// right after the first visit, every script and stylesheet must already be kept (not only after a second visit)
const missing = await p3.evaluate(async () => {
  const kept = new Set();
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) kept.add(new URL(r.url).pathname);
  return [...document.querySelectorAll("script[src], link[rel=stylesheet]")].map(e => new URL(e.src || e.href, location.href)).filter(u => u.origin === location.origin && !kept.has(u.pathname)).map(u => u.pathname);
});
check(!missing.length, `every file is kept for offline use on the first visit${missing.length ? " (missing " + missing.length + ", e.g. " + missing[0] + ")" : ""}`);
await off.setOffline(true);
await p3.reload({ waitUntil: "load" });
await p3.goto(BASE + "#/games/chess"); await p3.waitForTimeout(800);
check(await p3.evaluate(() => !!document.querySelector("#app-chess") && document.querySelectorAll("script").length > 40 && typeof Hub === "object"), "the app and a game never opened before work offline");
await off.close();

await close();
if (errors.length) { console.log("Page errors:\n" + errors.join("\n")); process.exit(1); }
if (failures.length) { console.log(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log("\nPlayers, notes and backup: all fine.");
