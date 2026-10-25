/* Grown-ups: a page at #/grownups for parents.
   1. A progress report for the player who is on now: how much was practised the last 7 days, and for every
      subject how accurate the answers are in each topic, so you can see at a glance what needs more practice.
   0. This week, every player: days practised, questions and how many were right (against last week), time in
      learning and in games, the topics that need practice and the strong ones, ready to copy into a message.
   2. Players: rename or remove the family's players (each has their own progress).
   5. Comfort: less motion and bigger buttons, for this device.
   3. Play-test notes: what the kids flagged with the 💬 button in a game, ready to copy and send.
   4. A backup: progress only lives in this browser, so here you can copy a "progress code" (or save it as a file)
      with every player in it, and paste it on another phone, tablet or computer to carry everything over.
   Nothing leaves the device unless you copy it yourself. */
(function(){
  "use strict";
  const store = Hub.store;

  /* ---------------- the backup code: the saved progress, squashed and written in letters ---------------- */
  const b64 = bytes => { let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64 = t => { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  async function pipe(bytes, stream){
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const P = Hub.Profiles;
  // the code holds every player: { __lp: 2, profiles, stores: { id: progress } }; old codes hold one progress
  function everything(){
    Hub.saveStore();
    const meta = P.data(), stores = {};
    meta.list.forEach(p => { try { stores[p.id] = p.id === meta.active ? store : JSON.parse(localStorage.getItem(P.keyOf(p.id)) || "{}"); } catch (e) { stores[p.id] = {}; } });
    return { __lp: 2, profiles: { active: meta.active, list: meta.list }, stores };
  }
  function restore(data){
    if (data.__lp === 2 && data.profiles && Array.isArray(data.profiles.list) && data.stores) {
      const meta = P.data();
      data.profiles.list.forEach(p => { if (p && typeof p.id === "string" && /^[\w-]{1,40}$/.test(p.id)) localStorage.setItem(P.keyOf(p.id), JSON.stringify(data.stores[p.id] || {})); });
      meta.list = data.profiles.list.filter(p => p && typeof p.id === "string" && /^[\w-]{1,40}$/.test(p.id)).map(p => ({ id: p.id, name: String(p.name || "").slice(0, 20), face: P.FACES.includes(p.face) ? p.face : P.FACES[0] }));
      meta.active = meta.list.some(p => p.id === data.profiles.active) ? data.profiles.active : meta.list[0].id;
      P.save();
    } else localStorage.setItem(Hub.STORE_KEY, JSON.stringify(data));
  }
  async function makeCode(){
    const raw = new TextEncoder().encode(JSON.stringify(everything()));
    if (typeof CompressionStream === "function") return "LP2-" + b64(await pipe(raw, new CompressionStream("gzip")));
    return "LP1-" + b64(raw);
  }
  async function readCode(text){
    const t = text.replace(/\s+/g, "");
    const m = /^(LP[12])-([A-Za-z0-9_-]+)$/.exec(t);
    if (!m) throw new Error("That doesn't look like a progress code.");
    let bytes = unb64(m[2]);
    if (m[1] === "LP2") {
      if (typeof DecompressionStream !== "function") throw new Error("This browser can't open that code. Try a newer one.");
      bytes = await pipe(bytes, new DecompressionStream("gzip"));
    }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("That code is damaged.");
    return data;
  }

  /* ---------------- the report ---------------- */
  const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function lastDays(n){
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push({ key: dayKey(d), label: d.toLocaleDateString("en-GB", { weekday: "short" }) }); }
    return out;
  }
  const pct = (c, a) => a ? Math.round(c / a * 100) : null;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const tone = p => p === null ? "none" : p >= 85 ? "great" : p >= 65 ? "ok" : "low";

  function report(){
    const subjects = (window.Notebook && Notebook.subjects) || [];
    const days = lastDays(7);
    const perDay = days.map(d => {
      let a = 0, c = 0;
      subjects.forEach(s => { const e = s.data.log && s.data.log[d.key]; if (e) { a += e.a; c += e.c; } });
      const t = store.typing && store.typing.log && store.typing.log[d.key];
      return { ...d, a, c, lessons: t ? t.a : 0 };
    });
    const week = perDay.reduce((n, d) => n + d.a, 0), weekRight = perDay.reduce((n, d) => n + d.c, 0);
    const lessonsWeek = perDay.reduce((n, d) => n + d.lessons, 0), activeDays = perDay.filter(d => d.a || d.lessons).length;
    const max = Math.max(5, ...perDay.map(d => d.a + d.lessons * 5));
    const apps = Hub.appList();
    const trophies = apps.reduce((n, a) => n + a.earned, 0), trophiesAll = apps.reduce((n, a) => n + a.badges, 0);

    let html = `<section class="gu-card">
      <h2>This week</h2>
      <div class="gu-summary">
        <div><b>${activeDays}</b><span>of 7 days practised</span></div>
        <div><b>${week}</b><span>questions answered</span></div>
        <div><b>${pct(weekRight, week) === null ? "-" : pct(weekRight, week) + "%"}</b><span>answered right</span></div>
        <div><b>${lessonsWeek}</b><span>typing lessons</span></div>
      </div>
      <div class="gu-days">${perDay.map(d => `<div class="gu-day"><div class="gu-bar" style="height:${Math.round((d.a + d.lessons * 5) / max * 100)}%" title="${d.a} questions, ${d.lessons} typing lessons"></div><span>${d.label}</span></div>`).join("")}</div>
      <p class="gu-note">Counted from today on. Older practice shows up in the totals below.</p>
    </section>`;

    subjects.forEach(s => {
      const d = s.data;
      let tA = 0, tC = 0;
      const rows = s.topics.map(t => {
        const e = d.topics && d.topics[t.id] || { attempted: 0, correct: 0 };
        tA += e.attempted; tC += e.correct;
        const p = pct(e.correct, e.attempted), low = p !== null && p < 65 && e.attempted >= 5;
        return `<div class="gu-topic"><span class="gu-tname">${esc(t.icon || "")} ${esc(t.label)}</span>
          <span class="gu-meter ${tone(p)}"><i style="width:${p === null ? 0 : p}%"></i></span>
          <span class="gu-pct">${p === null ? "not tried" : p + "%"}</span>
          <span class="gu-flag">${low ? "needs practice" : e.attempted >= 5 && p >= 85 ? "strong" : ""}</span></div>`;
      }).join("");
      const best = d.best || 0, races = d.racesWon || 0, trials = Object.keys(d.trialBest || {}).length;
      html += `<section class="gu-card">
        <h2>${esc(s.icon)} ${esc(s.title)} <small>${tA ? tA + " questions · " + pct(tC, tA) + "% right" : "not started"}</small></h2>
        ${rows}
        <p class="gu-note">Best streak ${best} · races won ${races} · time trials tried ${trials}</p>
      </section>`;
    });

    const T = store.typing;
    if (T) {
      const best = T.best || {}, passed = Object.keys(best).length, stars = Object.values(best).reduce((n, b) => n + (b.stars || 0), 0);
      html += `<section class="gu-card">
        <h2>⌨️ Tipp-Meister <small>${passed ? passed + " of 80 lessons passed" : "not started"}</small></h2>
        <div class="gu-topic"><span class="gu-tname">Lessons passed</span><span class="gu-meter ok"><i style="width:${Math.round(passed / 80 * 100)}%"></i></span><span class="gu-pct">${passed}/80</span><span class="gu-flag"></span></div>
        <p class="gu-note">${stars} stars · fastest ${T.topApm || 0} strokes a minute${T.roboWins ? " · beat Robo " + T.roboWins + " times" : ""}</p>
      </section>`;
    }

    const learn = apps.filter(a => a.section === "learning" && a.stat && !(window.Notebook && Notebook.subjects.some(s => s.id === a.id)) && a.id !== "typing");
    const games = apps.filter(a => a.section === "games" && a.stat);
    const lines = [...learn, ...games];
    html += `<section class="gu-card">
      <h2>🏆 Games and trophies <small>${trophies} of ${trophiesAll} trophies</small></h2>
      ${lines.length ? `<ul class="gu-list">${lines.map(a => `<li><span>${esc(a.icon)} ${esc(a.title)}</span><b>${esc(a.stat)}</b></li>`).join("")}</ul>` : `<p class="gu-note">No scores yet.</p>`}
    </section>`;
    return html;
  }

  /* ---------------- the weekly summary: every player, this week against last week ---------------- */
  // a player's progress: the live store for the one playing, the saved copy for the others
  const storeOf = id => id === P.data().active ? store : (() => { try { return JSON.parse(localStorage.getItem(P.keyOf(id))) || {}; } catch (e) { return {}; } })();
  // where a subject keeps its progress inside a store (Fast Math keeps it at the top level)
  const subjectData = (s, st) => { if (s.data === store) return st; const k = Object.keys(store).find(key => store[key] === s.data); return (k && st[k]) || {}; };
  const mins = sec => { const m = Math.round((sec || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  function weekOf(st){
    const subjects = (window.Notebook && Notebook.subjects) || [], all = lastDays(14), weeks = [all.slice(0, 7), all.slice(7)];
    const sum = days => {
      let a = 0, c = 0, lessons = 0, learn = 0, play = 0, active = 0;
      days.forEach(d => {
        let da = 0;
        subjects.forEach(s => { const e = ((subjectData(s, st).log) || {})[d.key]; if (e) { a += e.a; c += e.c; da += e.a; } });
        const t = st.typing && st.typing.log && st.typing.log[d.key]; if (t) { lessons += t.a; da += t.a; }
        const tl = st.timeLog && st.timeLog[d.key]; if (tl) { learn += tl.learning || 0; play += tl.games || 0; }
        if (da || (tl && (tl.learning || tl.games))) active++;
      });
      return { a, c, lessons, learn, play, active };
    };
    const topics = [];
    subjects.forEach(s => { const d = subjectData(s, st); s.topics.forEach(t => { const e = d.topics && d.topics[t.id]; if (e && e.attempted >= 5) topics.push({ name: t.label, subject: s.title, p: Math.round(e.correct / e.attempted * 100), n: e.attempted }); }); });
    topics.sort((x, y) => x.p - y.p);
    const right = subjects.reduce((n, s) => n + Object.values(subjectData(s, st).topics || {}).reduce((m, t) => m + (t.correct || 0), 0), 0);
    const stars = Math.max(0, Math.floor(right / 10) + Object.keys((st.typing && st.typing.best) || {}).length - (st.starsSpent || 0));
    return { now: sum(weeks[1]), before: sum(weeks[0]), weak: topics.filter(t => t.p < 75).slice(0, 2), strong: topics.filter(t => t.p >= 85 && t.n >= 10).slice(-2).reverse(), stars };
  }
  function weeklyLine(p){
    const w = weekOf(storeOf(p.id)), n = w.now, b = w.before, pc = (c, a) => a ? Math.round(c / a * 100) + "%" : "-";
    return { p, w, text: `${p.name || "Player"}: practised ${n.active} of 7 days, ${n.a} questions (${pc(n.c, n.a)} right; last week ${b.a}, ${pc(b.c, b.a)}), learning ${mins(n.learn)}, games ${mins(n.play)}${n.lessons ? `, ${n.lessons} typing lessons` : ""}.` +
      (w.weak.length ? ` Needs practice: ${w.weak.map(t => `${t.name} in ${t.subject} (${t.p}%)`).join(", ")}.` : "") +
      (w.strong.length ? ` Strong: ${w.strong.map(t => `${t.name} (${t.p}%)`).join(", ")}.` : "") + ` ⭐ ${w.stars} study stars to spend.` };
  }
  function weekly(){
    const lines = P.data().list.map(weeklyLine), arrow = (x, y) => x > y ? "▲" : x < y ? "▼" : "";
    return `<h2>📋 This week, every player <small>the last 7 days, against the 7 before</small></h2>` + lines.map(({ p, w }) => {
      const n = w.now, b = w.before;
      return `<div class="gu-week"><h3>${esc(p.face || "🙂")} ${esc(p.name || "Player")}</h3>
        <div class="gu-summary">
          <div><b>${n.active}/7</b><span>days practised</span></div>
          <div><b>${n.a} <small>${arrow(n.a, b.a)}</small></b><span>questions (last week ${b.a})</span></div>
          <div><b>${n.a ? Math.round(n.c / n.a * 100) + "%" : "-"}</b><span>right${b.a ? ` (last week ${Math.round(b.c / b.a * 100)}%)` : ""}</span></div>
          <div><b>${mins(n.learn)}</b><span>learning · games ${mins(n.play)}</span></div>
        </div>
        <p class="gu-note">${w.weak.length ? `Needs practice: <b>${w.weak.map(t => `${esc(t.name)}</b> in ${esc(t.subject)} (${t.p}%)`).join(", <b>")}. ` : "No weak topics yet. "}${w.strong.length ? `Strong: ${w.strong.map(t => `${esc(t.name)} (${t.p}%)`).join(", ")}. ` : ""}⭐ ${w.stars} study stars to spend.</p>
      </div>`;
    }).join("") + `<div class="gu-row"><button class="btn ghost" id="guWeekCopy" type="button">📋 Copy the summary</button><span class="gu-msg" id="guWeekMsg" aria-live="polite"></span></div>
      <p class="gu-note">Time counts while a subject or game is open on screen. Copy the summary to send it in a message.</p>`;
  }
  const weeklyText = () => `Learn & Play, week to ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })}\n` + P.data().list.map(p => weeklyLine(p).text).join("\n");

  /* ---------------- the page ---------------- */
  Hub.page("grownups", {
    title: "Grown-ups",
    mount(host){
      host.innerHTML = `
      <div class="wrap gu">
        <header class="hub-head">
          <a class="back-link" href="#/">← Home</a>
          <h1>👪 Grown-ups</h1>
          <p class="tagline">How practice is going, and a way to take progress to another device.</p>
        </header>
        <section class="gu-card" id="guWeek"></section>
        <div id="guReport"></div>
        <section class="gu-card" id="guPlayers"></section>
        <section class="gu-card" id="guNotes"></section>
        <section class="gu-card" id="guComfort">
          <h2>♿ Comfort</h2>
          <p class="gu-note">For this device, every player. Less motion turns off confetti, wobbles, the rainbow flashes and screen shakes; bigger buttons make menu buttons easier to tap.</p>
          <div class="gu-row">
            <button class="btn ghost" type="button" data-comfort="motion" aria-pressed="false"></button>
            <button class="btn ghost" type="button" data-comfort="big" aria-pressed="false"></button>
          </div>
        </section>
        <section class="gu-card" id="guBackup">
          <h2>💾 Back up or move progress</h2>
          <p class="gu-note">Progress is saved in this browser only. If the browser is cleared, or you switch to a new phone, it would be lost. Copy the progress code below (it holds every player), keep it somewhere safe, and paste it on the other device to bring everything back.</p>
          <p class="gu-note"><b id="guLast"></b></p>
          <div class="gu-row">
            <button class="btn" id="guMake" type="button">1. Make my progress code</button>
          </div>
          <textarea id="guCode" class="gu-code" rows="4" readonly placeholder="Your progress code will show up here" aria-label="Progress code"></textarea>
          <div class="gu-row">
            <button class="btn ghost" id="guCopy" type="button" disabled>📋 Copy</button>
            <button class="btn ghost" id="guSave" type="button" disabled>⬇ Save as a file</button>
            <span class="gu-msg" id="guMsg1" aria-live="polite"></span>
          </div>
          <hr>
          <h3>Bring progress back</h3>
          <textarea id="guPaste" class="gu-code" rows="3" placeholder="Paste a progress code here, or choose a saved file" aria-label="Paste a progress code"></textarea>
          <div class="gu-row">
            <button class="btn" id="guRestore" type="button">Restore from this code</button>
            <label class="btn ghost gu-file">📂 Choose a saved file<input id="guFile" type="file" accept=".txt,.lpcode,text/plain" hidden></label>
            <span class="gu-msg" id="guMsg2" aria-live="polite"></span>
          </div>
          <p class="gu-note">Restoring replaces the progress on this device with the progress in the code.</p>
        </section>
      </div>`;
      const $ = id => host.querySelector("#" + id);
      let code = "";
      // the players: rename or remove (the one playing now can't be removed)
      function renderPlayers(){
        const meta = P.data();
        $("guPlayers").innerHTML = `<h2>👨‍👩‍👦 Players</h2><p class="gu-note">Each player has their own progress, coins and trophies. Switch player on the home screen. The report above is for ${esc((P.active().face || "") + " " + (P.active().name || "Player"))}.</p><ul class="gu-list">` +
          meta.list.map(p => `<li><span>${esc(p.face || "🙂")} ${esc(p.name || "Player")}${p.id === meta.active ? " <small>(playing now)</small>" : ""}</span><span class="gu-row"><button class="btn ghost small" type="button" data-rename="${esc(p.id)}">Rename</button>${p.id === meta.active ? "" : `<button class="btn ghost small" type="button" data-remove="${esc(p.id)}">Remove</button>`}</span></li>`).join("") + `</ul>`;
      }
      $("guPlayers").addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        const meta = P.data();
        if (b.dataset.rename) { const p = meta.list.find(q => q.id === b.dataset.rename), n = prompt("New name", p.name || ""); if (n !== null && n.trim()) { P.rename(p.id, n); if (p.id === meta.active) { store.name = n.trim().slice(0, 20); Hub.saveStore(); } renderPlayers(); } }
        if (b.dataset.remove) { const p = meta.list.find(q => q.id === b.dataset.remove); if (confirm(`Remove ${p.name || "this player"} and all their progress? This can't be undone (unless you have a progress code).`)) { P.remove(p.id); renderPlayers(); } }
      });
      $("guWeek").addEventListener("click", async e => {
        if (!e.target.closest("#guWeekCopy")) return;
        try { await navigator.clipboard.writeText(weeklyText()); $("guWeekMsg").textContent = "Copied!"; } catch (err) { prompt("Copy the summary", weeklyText()); }
      });
      function renderComfort(){
        const c = Hub.comfort();
        host.querySelectorAll("[data-comfort]").forEach(b => { const on = !!c[b.dataset.comfort]; b.setAttribute("aria-pressed", String(on)); b.textContent = (b.dataset.comfort === "motion" ? "🐢 Less motion: " : "🔍 Bigger buttons: ") + (on ? "ON" : "OFF"); });
      }
      $("guComfort").addEventListener("click", e => { const b = e.target.closest("[data-comfort]"); if (!b) return; const c = Hub.comfort(); Hub.setComfort(b.dataset.comfort, !c[b.dataset.comfort]); renderComfort(); });
      renderComfort();
      // play-test notes from the 💬 button
      function renderNotes(){
        const notes = window.Feedback ? Feedback.all() : [];
        $("guNotes").innerHTML = `<h2>📝 Play-test notes</h2><p class="gu-note">When something in a game is too hard, boring, broken or a great idea, the 💬 button in the game saves a note here. Copy them all and send them on to whoever is building the app.</p>` +
          (notes.length ? `<ul class="gu-list gu-notes">${notes.slice().reverse().map(n => `<li><span>${esc(n.icon || "")} <b>${esc(n.title)}</b> · ${esc(n.kind)}${n.text ? ": " + esc(n.text) : ""}</span><small>${esc(n.who || "")} · ${new Date(n.t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></li>`).join("")}</ul>
            <div class="gu-row"><button class="btn" id="guNotesCopy" type="button">📋 Copy all ${notes.length} notes</button><button class="btn ghost" id="guNotesClear" type="button">🗑️ Clear</button><span class="gu-msg" id="guNotesMsg" aria-live="polite"></span></div>`
            : `<p class="gu-note">No notes yet.</p>`);
      }
      $("guNotes").addEventListener("click", async e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.id === "guNotesCopy") { try { await navigator.clipboard.writeText(Feedback.asText()); $("guNotesMsg").textContent = "Copied!"; } catch (err) { prompt("Copy these notes", Feedback.asText()); } }
        if (b.id === "guNotesClear" && confirm("Clear all play-test notes?")) { Feedback.clear(); renderNotes(); }
      });
      const lastBackupText = () => { const t = P.data().lastBackup; if (!t) return "No progress code made yet on this device."; const d = Math.floor((Date.now() - t) / 864e5); return `Last progress code made ${d === 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"}.`; };
      $("guMake").addEventListener("click", async () => {
        try {
          code = await makeCode();
          P.data().lastBackup = Date.now(); P.save(); $("guLast").textContent = lastBackupText();
          $("guCode").value = code; $("guCopy").disabled = false; $("guSave").disabled = false;
          $("guMsg1").textContent = `Done: ${code.length.toLocaleString("en")} characters`;
          $("guCode").focus(); $("guCode").select();
        } catch (e) { $("guMsg1").textContent = "Sorry, that didn't work: " + e.message; }
      });
      $("guCopy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(code); $("guMsg1").textContent = "Copied!"; }
        catch (e) { $("guCode").select(); document.execCommand && document.execCommand("copy"); $("guMsg1").textContent = "Copied (or select it and copy by hand)"; }
      });
      $("guSave").addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
        a.download = "learn-and-play-" + dayKey(new Date()) + ".lpcode";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        $("guMsg1").textContent = "Saved";
      });
      $("guFile").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        $("guPaste").value = (await f.text()).trim(); $("guMsg2").textContent = "File loaded. Now tap Restore."; e.target.value = "";
      });
      $("guRestore").addEventListener("click", async () => {
        try {
          const data = await readCode($("guPaste").value);
          const what = data.__lp === 2 ? `${data.profiles.list.length} player${data.profiles.list.length === 1 ? "" : "s"}` : `${Object.keys(data).length} saved things`;
          if (!confirm(`Replace the progress on this device with the progress in this code (${what})?`)) return;
          restore(data);
          $("guMsg2").textContent = "Restored! Loading...";
          setTimeout(() => { location.hash = "#/"; location.reload(); }, 600);
        } catch (e) { $("guMsg2").textContent = e.message || "That didn't work."; }
      });
      return {
        open(){ $("guWeek").innerHTML = weekly(); $("guReport").innerHTML = report(); renderPlayers(); renderNotes(); $("guLast").textContent = lastBackupText(); },
        close(){}
      };
    }
  });
})();
