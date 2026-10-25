/* The presenter: Robo 🤖 shows a newcomer around.
     Guided tour   Robo points at each part of the home screen in turn (players, Learning, Games, the daily
                   challenges, search, the shop, the grown-ups page) with a spotlight and a speech bubble.
     Show reel     then, if you like, Robo presents every app one by one, full screen: a big spinning icon,
                   what it is, your best and trophies, and a "Try it" button. It moves on by itself (or use
                   ◀ ▶, Space to pause), with chapters to jump to: Learning, then each group of games.
   Robo can read it all out loud (🔊). On a first visit the home screen offers the tour with a small banner
   (it never pops up by itself), and the "🎬 Meet the apps" link starts it any time.
     Tour.start()   the guided tour        Tour.reel(i)   the show reel, from app i */
(function(){
  "use strict";
  const store = Hub.store;
  const SEEN = "lp-tour-seen";   // per device, not per player: a newcomer is new to the whole app
  const seen = () => { try { return localStorage.getItem(SEEN) === "1"; } catch (e) { return true; } };
  const markSeen = () => { try { localStorage.setItem(SEEN, "1"); } catch (e) {} };

  /* ---------------- Robo's voice ---------------- */
  let voiceOn = true;
  function say(text){
    if (!voiceOn || store.sound === false || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ""));
      u.lang = "en-GB"; u.rate = 1.02; u.pitch = 1.25;
      const v = speechSynthesis.getVoices().find(x => x.lang.startsWith("en"));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  const hush = () => { try { speechSynthesis.cancel(); } catch (e) {} };

  // the overlay both parts share
  const root = document.createElement("div");
  root.className = "tour-root"; root.hidden = true;
  document.body.appendChild(root);
  const voiceBtn = () => `<button class="tour-voice" type="button" aria-label="Robo reads out loud">${voiceOn ? "🔊" : "🔇"}</button>`;
  root.addEventListener("click", e => {
    if (!e.target.closest(".tour-voice")) return;
    voiceOn = !voiceOn; e.target.closest(".tour-voice").textContent = voiceOn ? "🔊" : "🔇";
    if (!voiceOn) hush();
  });
  function close(){ root.hidden = true; root.innerHTML = ""; root.className = "tour-root"; hush(); document.removeEventListener("keydown", keys); window.removeEventListener("resize", place); clearInterval(reelTimer); markSeen(); showBanner(); }

  /* ---------------- the guided tour of the home screen ---------------- */
  const count = s => Hub.appList().filter(a => a.section === s).length;
  const STEPS = [
    { text: () => `Hi${store.name ? " " + store.name : ""}! I'm Robo, your guide. Learn & Play has ${count("learning")} learning apps and ${count("games")} games. Let me show you around!` },
    { at: "#profileRow", text: () => "Everyone in the family can have their own player, with their own coins, trophies and progress. Tap a name to switch, or ➕ to add one." },
    { at: ".door.learning", text: () => `📚 Learning: ${count("learning")} subjects for 5th grade in Zug. Maths, English, German, French, NMG, music, typing and even quantum physics. Every answer is explained, and there's a race or a 3D adventure above the questions!` },
    { at: ".door.games", text: () => `🎮 Games: ${count("games")} of them! Racing, sports, adventures, arcade classics, building games and brain games.` },
    { at: "#dailyCard", text: () => "📅 Every day there are three new challenges. Finish them for 🪙 coins, and play every day to keep your 🔥 streak going." },
    { at: "#appSearch", text: () => "🔎 Looking for something? Type here to find any game or subject straight away." },
    { at: '.home-grownups a[href="#/shop"]', text: () => "🛍️ Spend your coins in the Shop on new looks: pool cloths and bowling balls." },
    { at: '.home-grownups a[href="#/grownups"]', text: () => "👪 For grown-ups: a progress report, the players, play-test notes and a backup code to move everything to another device." },
    { end: true, text: () => "That's the tour! Want me to present every single app, one by one?" }
  ];
  let stepI = 0, mode = "";
  function start(){
    if (location.hash && location.hash !== "#/") location.hash = "#/";
    mode = "tour"; stepI = 0;
    root.hidden = false; root.className = "tour-root tour-mode";
    root.innerHTML = `<div class="tour-spot"></div>
      <div class="tour-bubble" role="dialog" aria-live="polite" aria-label="Robo's tour">
        <div class="tour-robo" aria-hidden="true">🤖</div>
        <div class="tour-body"><p class="tour-text"></p><div class="tour-btns"></div></div>
        <div class="tour-top">${voiceBtn()}<button class="tour-x" type="button" aria-label="Close the tour">✕</button></div>
      </div>`;
    root.querySelector(".tour-x").onclick = close;
    document.addEventListener("keydown", keys);
    window.addEventListener("resize", place);
    step(0);
  }
  function step(i){
    stepI = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[stepI], text = s.text();
    root.querySelector(".tour-text").textContent = text;
    const btns = root.querySelector(".tour-btns");
    btns.innerHTML = s.end
      ? `<button class="btn" type="button" data-go="reel">🎬 Show me every app</button><button class="btn ghost" type="button" data-go="done">Let's play!</button>`
      : `${stepI ? '<button class="btn ghost small" type="button" data-go="back">◀ Back</button>' : ""}<button class="btn small" type="button" data-go="next">${stepI ? "Next ▶" : "Show me! ▶"}</button><span class="tour-count">${stepI + 1}/${STEPS.length}</span>`;
    btns.onclick = e => {
      const b = e.target.closest("[data-go]"); if (!b) return;
      ({ next: () => step(stepI + 1), back: () => step(stepI - 1), done: close, reel: () => reel(0) })[b.dataset.go]();
    };
    const target = s.at && document.querySelector(s.at);
    if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(place, target ? 350 : 0);
    const bubble = root.querySelector(".tour-bubble");
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    say(text);
    btns.querySelector(".btn:last-of-type, .btn").focus({ preventScroll: true });
  }
  // the spotlight hugs the thing Robo talks about; the bubble sits below it (or above, near the bottom)
  function place(){
    if (mode !== "tour" || root.hidden) return;
    const s = STEPS[stepI], target = s.at && document.querySelector(s.at);
    const spot = root.querySelector(".tour-spot"), bubble = root.querySelector(".tour-bubble");
    if (!spot || !bubble) return;
    if (!target) { spot.className = "tour-spot none"; bubble.style.top = "50%"; bubble.style.transform = "translate(-50%, -50%)"; return; }
    const r = target.getBoundingClientRect(), pad = 8;
    spot.className = "tour-spot";
    Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const below = r.bottom + 16, bh = bubble.offsetHeight;
    const top = below + bh < innerHeight - 8 ? below : Math.max(8, r.top - bh - 16);
    bubble.style.top = top + "px"; bubble.style.transform = "translateX(-50%)";
  }

  /* ---------------- the show reel of every app ---------------- */
  const TEASE = ["Next up:", "Ooh, this one's cool:", "Check this out:", "One of my favourites:", "Here's", "Have you tried", "And now:"];
  const STAY = 7;   // seconds on each app
  let reelList = [], reelI = 0, reelTimer = 0, reelT = 0, playing = true;
  function chapters(){
    const list = Hub.appList(), chs = [{ title: "📚 Learning", apps: list.filter(a => a.section === "learning") }];
    const listed = new Set();
    Hub.CATEGORIES.forEach(c => { const apps = c.ids.map(id => list.find(a => a.id === id)).filter(Boolean); apps.forEach(a => listed.add(a.id)); if (apps.length) chs.push({ title: c.title, apps }); });
    const rest = list.filter(a => a.section === "games" && !listed.has(a.id));
    if (rest.length) chs.push({ title: "✨ More games", apps: rest });
    return chs;
  }
  function reel(i){
    mode = "reel";
    if (location.hash && location.hash !== "#/") location.hash = "#/";
    const chs = chapters();
    reelList = chs.flatMap(c => c.apps.map(a => Object.assign({ chapter: c.title }, a)));
    root.hidden = false; root.className = "tour-root reel-mode";
    root.innerHTML = `
      <div class="reel-stars" aria-hidden="true"></div>
      <div class="reel-top">
        <div class="reel-chapters">${chs.map(c => `<button type="button" class="reel-ch" data-ch="${reelList.findIndex(a => a.chapter === c.title)}">${c.title}</button>`).join("")}</div>
        <div class="reel-tools">${voiceBtn()}<button class="tour-x" type="button" aria-label="Close the show">✕</button></div>
      </div>
      <div class="reel-stage" aria-live="polite">
        <div class="reel-icon"></div>
        <div class="reel-where"></div>
        <h2 class="reel-title"></h2>
        <p class="reel-blurb"></p>
        <div class="reel-facts"></div>
        <button class="btn reel-try" type="button">🎮 Try it!</button>
      </div>
      <div class="reel-robo"><span class="tour-robo" aria-hidden="true">🤖</span><span class="reel-say"></span></div>
      <div class="reel-bottom">
        <button class="btn ghost small" type="button" data-r="prev" aria-label="Previous app">◀</button>
        <button class="btn ghost small" type="button" data-r="play" aria-label="Pause">⏸</button>
        <button class="btn ghost small" type="button" data-r="next" aria-label="Next app">▶</button>
        <div class="reel-bar"><div class="reel-fill"></div></div>
        <span class="reel-num mono"></span>
      </div>`;
    const stars = root.querySelector(".reel-stars");
    for (let k = 0; k < 40; k++) { const s = document.createElement("i"); s.style.left = Math.random() * 100 + "%"; s.style.top = Math.random() * 100 + "%"; s.style.animationDelay = -Math.random() * 6 + "s"; stars.appendChild(s); }
    root.querySelector(".tour-x").onclick = close;
    root.querySelector(".reel-chapters").onclick = e => { const b = e.target.closest("[data-ch]"); if (b) show(+b.dataset.ch); };
    root.querySelector(".reel-bottom").onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; ({ prev: () => show(reelI - 1), next: () => show(reelI + 1), play: togglePlay })[b.dataset.r](); };
    root.querySelector(".reel-try").onclick = () => { const a = reelList[reelI]; close(); location.hash = `#/${a.section}/${a.id}`; };
    document.removeEventListener("keydown", keys); document.addEventListener("keydown", keys);
    playing = true; clearInterval(reelTimer);
    reelTimer = setInterval(() => {
      if (!playing) return;
      reelT += 0.1;
      root.querySelector(".reel-fill").style.width = Math.min(100, reelT / STAY * 100) + "%";
      if (reelT >= STAY) show(reelI + 1);
    }, 100);
    show(i || 0);
  }
  function show(i){
    reelI = (i + reelList.length) % reelList.length; reelT = 0;
    const a = reelList[reelI], q = s => root.querySelector(s);
    q(".reel-icon").textContent = a.icon;
    q(".reel-where").textContent = a.chapter;
    q(".reel-title").textContent = a.title;
    q(".reel-blurb").textContent = a.blurb || "";
    const facts = [];
    if (a.stat) facts.push(`<span>📈 ${a.stat}</span>`);
    if (a.badges) facts.push(`<span>🏆 ${a.earned}/${a.badges} trophies</span>`);
    q(".reel-facts").innerHTML = facts.join("");
    q(".reel-num").textContent = `${reelI + 1}/${reelList.length}`;
    root.querySelectorAll(".reel-ch").forEach(b => b.classList.toggle("on", reelList[reelI].chapter === b.textContent));
    // the card flies in again each time
    const stage = q(".reel-stage"); stage.classList.remove("in"); void stage.offsetWidth; stage.classList.add("in");
    const intro = reelI === 0 ? "Let's start with" : TEASE[reelI % TEASE.length];
    const line = `${intro} ${a.title}! ${a.blurb || ""}`;
    q(".reel-say").textContent = intro.endsWith(":") || intro === "Here's" || intro === "Let's start with" ? `${intro} ${a.title}!` : `${intro} ${a.title}?`;
    say(line);
  }
  function togglePlay(){
    playing = !playing;
    const b = root.querySelector('[data-r="play"]');
    b.textContent = playing ? "⏸" : "▶️"; b.setAttribute("aria-label", playing ? "Pause" : "Play");
    if (!playing) hush();
  }

  function keys(e){
    if (root.hidden) return;
    if (e.key === "Escape") { close(); return; }
    if (mode === "tour") {
      if (e.key === "ArrowRight") step(stepI + 1);
      if (e.key === "ArrowLeft") step(stepI - 1);
    } else {
      if (e.key === "ArrowRight") show(reelI + 1);
      if (e.key === "ArrowLeft") show(reelI - 1);
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.key === "Enter" && document.activeElement === document.body) root.querySelector(".reel-try").click();
    }
  }

  /* ---------------- the way in, on the home screen ---------------- */
  const head = document.querySelector("#homeView .hub-head");
  const banner = document.createElement("div");
  banner.className = "tour-banner"; banner.hidden = true;
  banner.innerHTML = `<span>👋 New here? Let Robo 🤖 show you around!</span><button class="btn small" type="button" data-t="tour">Start the tour</button><button class="tour-banner-x" type="button" aria-label="No thanks">✕</button>`;
  head.after(banner);
  banner.onclick = e => {
    if (e.target.closest("[data-t]")) { banner.hidden = true; start(); }
    if (e.target.closest(".tour-banner-x")) { markSeen(); banner.hidden = true; }
  };
  function showBanner(){ banner.hidden = seen(); }
  showBanner();
  // and a link next to the Shop and Grown-ups ones, for any time
  const links = document.querySelector('.home-grownups a[href="#/shop"]');
  const meet = document.createElement("a");
  meet.href = "#/"; meet.textContent = "🎬 Meet the apps"; meet.className = "tour-link";
  meet.onclick = e => { e.preventDefault(); start(); };
  links.before(meet, document.createTextNode(" · "));

  window.Tour = { start, reel };
})();
