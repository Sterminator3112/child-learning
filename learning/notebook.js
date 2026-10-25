/* Learning notebook: the practice page every Learning subject shares. A subject brings its topics
   (each one makes endless fresh questions at three levels) and gets the topic line, levels,
   worked answers, a Time Trial, the race against Robo and trophies for the Learning shelf.

   Notebook.register({
     id, title, icon, blurb,       like Hub.register
     unit, tagline, nameFallback   the header: "/// a maths practice notebook", the line under it, who it's for
     taglineFor                    optional: the word before the name, "for" unless it's another language
     subject                       "maths", "English"... for the reset question
     data                          the object progress is saved in, inside Hub.store
     badgePrefix, badgeNames       trophy ids must be unique across apps; names can be swapped per subject
     wordy                         true for word questions, so they're not shown in the number font
     scene                         optional: scene(el) builds something fun above the questions (like Word Wizard's duel)
                                   and returns { answer(correct, streak), topic(id), open(), close() }
     verdicts                      optional { right: "Richtig!", wrong: "Nicht ganz – richtig ist" } for another language
     listenLabel                   optional: the 🔊 button's words, "🔊 Listen" unless it's another language
     topics: [{ id, label, icon, title, levelDesc: { warmup, practice, challenge }, hint, inputMode,
                modes (optional [{ id, label }]), generate(level, mode) -> a question }]
   })

   A question is { prompt or promptHtml, check(answer), explain() -> html, answerDisplay, hint }, plus
   optionally choices: [...] (answer buttons instead of typing), keys: [...] (extra letter buttons
   like ä ö ü), say: { text, lang } or a function that plays a sound (a 🔊 button), and sayAfter
   (show 🔊 only once it's answered).
   Notebook.pick() and Notebook.typed() build the word kinds. */
(function(){
  "use strict";

  /* ---------------- helpers for subjects ---------------- */
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function sample(arr, n){ return shuffle(arr.slice()).slice(0, n); }
  function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  // forgiving match for typed words: case, spaces, end punctuation, curly quotes, and ae/oe/ue/ss for ä/ö/ü/ß
  function norm(s){
    return String(s).trim().toLowerCase()
      .replace(/[’‘`]/g, "'").replace(/\s+/g, " ").replace(/[.!?,]+$/, "")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  }

  // a question answered by tapping one of the options (options include the answer)
  function pick(o){
    return {
      prompt: o.prompt, promptHtml: o.promptHtml, hint: o.hint || "", say: o.say, sayAfter: o.sayAfter,
      choices: o.keepOrder ? o.options.slice() : shuffle(o.options.slice()),
      check: v => v === o.answer,
      explain: () => o.explain,
      answerDisplay: o.answer
    };
  }
  // a question answered by typing; any of answers counts
  function typed(o){
    const ok = o.answers.map(norm);
    return {
      prompt: o.prompt, promptHtml: o.promptHtml, hint: o.hint || "", say: o.say, sayAfter: o.sayAfter, keys: o.keys,
      check: v => ok.includes(norm(v)),
      accepts: ok,
      explain: () => o.explain,
      answerDisplay: o.answerDisplay || o.answers[0]
    };
  }

  /* ---------------- reading words out loud ---------------- */
  const canSpeak = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
  const canPlay = say => typeof say === "function" || (canSpeak && !!say);
  function speak(say){
    if (typeof say === "function") { say(); return; }
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(say.text);
    u.lang = say.lang;
    u.rate = 0.85;
    const lang = say.lang.slice(0, 2).toLowerCase();
    const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  /* ---------------- difficulty levels ---------------- */
  const LEVELS = [
    { id: "warmup", label: "Warm-up" },
    { id: "practice", label: "Practice" },
    { id: "challenge", label: "Challenge" }
  ];

  /* ---------------- trophies: the same set for every subject, renamed to suit it ---------------- */
  function makeBadges(cfg, d){
    const total = () => totalCorrect(cfg.topics, d);
    const bestTrial = () => Math.max(0, ...Object.values(d.trialBest));
    const prefix = cfg.badgePrefix || "", names = cfg.badgeNames || {};
    const base = [
      { id: "first",    icon: "⭐", name: "First Lap",   desc: "Get your first answer right", test: () => total() >= 1 },
      { id: "streak5",  icon: "🔥", name: "Hot Streak",  desc: "5 right in a row",            test: () => d.best >= 5 },
      { id: "streak10", icon: "🚀", name: "On Fire",     desc: "10 right in a row",           test: () => d.best >= 10 },
      { id: "streak25", icon: "⚡", name: "Unstoppable", desc: "25 right in a row",           test: () => d.best >= 25 },
      { id: "race1",    icon: "🏁", name: "Race Winner", desc: "Win a race",                  test: () => d.racesWon >= 1 },
      { id: "race5",    icon: "🏆", name: "Champion",    desc: "Win 5 races",                 test: () => d.racesWon >= 5 },
      { id: "race20",   icon: "👑", name: "Legend",      desc: "Win 20 races",                test: () => d.racesWon >= 20 },
      { id: "trial",    icon: "⏱️", name: "Speed Demon", desc: "Score 15+ in a Time Trial",   test: () => bestTrial() >= 15 },
      { id: "challenge",icon: "💪", name: "Challenger",  desc: "10 right on Challenge level", test: () => d.challengeCorrect >= 10 },
      { id: "century",  icon: "💯", name: "Century",     desc: "100 right answers in total",  test: () => total() >= 100 }
    ];
    return base.map(b => {
      const rename = names[b.id];
      return Object.assign(b, { id: prefix + b.id }, rename ? { icon: rename[0], name: rename[1] } : {});
    }).concat(cfg.topics.map(t => ({
      id: prefix + "master-" + t.id, icon: t.icon || "🎓", name: t.label + " Master",
      desc: `20 right in ${t.label}`, test: () => d.topics[t.id].correct >= 20
    })));
  }
  function totalCorrect(topics, d){ return topics.reduce((sum, t) => sum + d.topics[t.id].correct, 0); }

  // every subject that registered, for the Grown-ups page
  const subjects = [];
  // count a question for today, so the Grown-ups page can show how much was practised each day
  function daily(d, correct){
    const t = new Date(), key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
    d.log = d.log || {};
    const day = d.log[key] = d.log[key] || { a: 0, c: 0 };
    day.a++; if (correct) day.c++;
    const keys = Object.keys(d.log).sort();
    while (keys.length > 60) delete d.log[keys.shift()];
  }
  function register(cfg){
    const d = cfg.data, TOPICS = cfg.topics;
    subjects.push({ id: cfg.id, title: cfg.title, icon: cfg.icon, data: d, topics: TOPICS.map(t => ({ id: t.id, label: t.label, icon: t.icon })) });
    if (!d.topic || !TOPICS.some(t => t.id === d.topic)) d.topic = TOPICS[0].id;
    if (!d.level) d.level = "warmup";
    if (!d.streak) d.streak = 0;
    if (!d.best) d.best = 0;
    if (!d.topics) d.topics = {};
    TOPICS.forEach(t => { if (!d.topics[t.id]) d.topics[t.id] = { attempted: 0, correct: 0 }; });
    if (!d.modes) d.modes = {};
    if (!d.trialBest) d.trialBest = {};
    if (!d.race) d.race = { you: 0, rival: 0 };
    if (!d.racesWon) d.racesWon = 0;
    if (!d.robo) d.robo = "easy";
    if (!d.challengeCorrect) d.challengeCorrect = 0;
    if (!Array.isArray(d.missed)) d.missed = [];

    const badges = makeBadges(cfg, d);
    Hub.register({
      id: cfg.id, section: "learning", title: cfg.title, icon: cfg.icon, blurb: cfg.blurb,
      stat: () => {
        const right = totalCorrect(TOPICS, d);
        return right ? `${right} right so far` : "";
      },
      badges,
      mount: host => mount(host, cfg, d, badges)
    });
  }

  function mount(host, cfg, d, BADGES){
    const TOPICS = cfg.topics;
    const store = Hub.store;
    const verdicts = cfg.verdicts || { right: "Correct!", wrong: "Not quite — the answer is" };
    const card = p => `
          <div class="problem ${cfg.wordy ? "wordy" : "mono"}" data-ref="${p}problem" aria-live="polite"></div>
          <button class="btn ghost small say-btn" data-ref="${p}say" type="button" hidden></button>
          <div class="choices" data-ref="${p}choices" role="group" aria-label="Answers" hidden></div>
          <div class="answer-row" data-ref="${p}answerRow">
            <input data-ref="${p}input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="your answer" aria-label="Your answer">
            <button class="btn" data-ref="${p}check" type="button">Check</button>
          </div>
          <div class="letter-keys" data-ref="${p}keys" hidden></div>`;

    host.innerHTML = `
    <div class="wrap">
      <header>
        <a class="back-link" href="#/learning">← Learning</a>
        <div class="wordmark">
          <h1 data-ref="title"></h1>
          <span class="unit mono" data-ref="unit"></span>
        </div>
        <p class="tagline"><span data-ref="tagline"></span> — <span data-ref="taglineFor"></span> <span data-ref="kidName"></span>.</p>
      </header>

      <nav class="line" aria-label="Topic" data-ref="topicNav">
        <div class="line-track" data-ref="topicTrack"></div>
      </nav>

      <div class="level-row" data-ref="levelRow">
        <div class="segmented" data-ref="levelSeg" role="group" aria-label="Difficulty"></div>
        <div class="level-desc" data-ref="levelDesc"></div>
      </div>

      <div class="level-row" data-ref="modeRow" hidden>
        <div class="segmented" data-ref="modeSeg" role="group" aria-label="Question type"></div>
      </div>

      <div class="level-row" data-ref="trialRow">
        <button class="btn ghost small" data-ref="timeTrialBtn" type="button">⏱ Time Trial — 16 in 2:00</button>
        <span class="level-desc" data-ref="trialBestText"></span>
      </div>

      <section class="race" data-ref="raceSection" aria-label="Race">
        <div class="race-head">
          <h2>🏁 Race to the finish</h2>
          <div class="race-controls">
            <div class="segmented" data-ref="roboSeg" role="group" aria-label="Robo driver"></div>
            <button class="btn ghost small" data-ref="raceRestartBtn" type="button">↻ Restart</button>
          </div>
        </div>
        <span class="race-msg" data-ref="raceMsg" aria-live="polite"></span>
        <div class="track">
          <div class="lane"><span class="lane-tag">YOU</span><div class="race-car you" data-ref="carYou"></div></div>
          <div class="lane"><span class="lane-tag">ROBO 🤖</span><div class="race-car rival" data-ref="carRival"></div></div>
        </div>
      </section>

      <section class="nb-scene" data-ref="scene" hidden></section>

      <section class="page" data-ref="practicePage">
        <h2 data-ref="topicTitle"></h2>
        ${card("p-")}
        <div class="feedback" data-ref="feedback">
          <div class="verdict" data-ref="verdict"></div>
          <div class="explain" data-ref="explain"></div>
        </div>
        <div class="card-foot">
          <button class="btn ghost small" data-ref="nextBtn" type="button" disabled>Next question →</button>
          <button class="btn ghost small" data-ref="reviewBtn" type="button" hidden></button>
          <span class="level-desc" data-ref="hintText"></span>
        </div>
      </section>

      <div class="ledger" data-ref="ledgerSection">
        <div class="stat"><span class="n mono" data-ref="stAttempted">0</span><span class="k">this session</span></div>
        <div class="stat"><span class="n mono" data-ref="stAccuracy">—</span><span class="k">accuracy</span></div>
        <div class="stat"><span class="n mono" data-ref="stStreak">0</span><span class="k">current streak</span></div>
        <div class="stat"><span class="n mono" data-ref="stBest">0</span><span class="k">best streak</span></div>
        <button class="btn ghost small ledger-reset" data-ref="resetBtn" type="button">Reset progress</button>
      </div>

      <section class="trial-page" data-ref="trialPage" hidden>
        <div class="trial-head">
          <h2>Time Trial</h2>
          <button class="btn ghost small" data-ref="trialExitBtn" type="button">✕ Exit</button>
        </div>
        <div data-ref="trialQuiz">
          <div class="trial-meta">
            <span class="mono" data-ref="trialQuestionCounter">Question 1 of 16</span>
            <span class="mono timer" data-ref="trialTimer">2:00</span>
          </div>
          <div class="trial-progress"><div class="trial-progress-fill" data-ref="trialProgressFill"></div></div>
          ${card("t-")}
          <div class="trial-quick" data-ref="trialQuickFeedback" aria-live="polite"></div>
        </div>
        <div class="rating-card" data-ref="trialResults" hidden>
          <div class="rating-label" data-ref="trialRatingLabel"></div>
          <div class="rating-score mono" data-ref="trialScore"></div>
          <div class="trial-results-actions">
            <button class="btn" data-ref="trialRetryBtn" type="button">Try again</button>
            <button class="btn ghost" data-ref="trialBackBtn" type="button">Back to practice</button>
          </div>
        </div>
      </section>
    </div>`;

    const $ = {};
    host.querySelectorAll("[data-ref]").forEach(el => { $[el.dataset.ref] = el; });
    $.title.textContent = cfg.title;
    $.unit.textContent = cfg.unit;
    $.tagline.textContent = cfg.tagline;
    host.querySelectorAll(".say-btn").forEach(b => { b.textContent = cfg.listenLabel || "🔊 Listen"; });
    $.taglineFor.textContent = cfg.taglineFor || "for";

    let currentTopicId = d.topic;
    let currentLevel = d.level;
    let currentMode = currentModeFor(topicNow());
    let sessionAttempted = 0, sessionCorrect = 0;
    let currentProblem = null, answered = false;
    let reviewItem = null;   // the missed question being reviewed, or null in normal practice
    let isOpen = false;
    const scene = cfg.scene ? cfg.scene($.scene) : null;
    if (scene) $.scene.hidden = false;

    function topicNow(){ return TOPICS.find(t => t.id === currentTopicId); }
    function currentModeFor(topic){
      if (!topic.modes) return null;
      const saved = d.modes[topic.id];
      return topic.modes.some(m => m.id === saved) ? saved : topic.modes[0].id;
    }

    /* ---------------- a question card: the practice page and the Time Trial each have one ---------------- */
    function cardRefs(p, onAnswer){
      const c = {
        problem: $[p + "problem"], say: $[p + "say"], choices: $[p + "choices"],
        answerRow: $[p + "answerRow"], input: $[p + "input"], check: $[p + "check"], keys: $[p + "keys"],
        prob: null
      };
      c.check.addEventListener("click", () => onAnswer(c.input.value.trim()));
      c.input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); onAnswer(c.input.value.trim()); }
      });
      c.choices.addEventListener("click", e => {
        const btn = e.target.closest("button.choice");
        if (btn && !btn.disabled) onAnswer(btn.dataset.value);
      });
      c.keys.addEventListener("click", e => {
        const btn = e.target.closest("button");
        if (!btn || c.input.disabled) return;
        const s = c.input.selectionStart ?? c.input.value.length, end = c.input.selectionEnd ?? s;
        c.input.value = c.input.value.slice(0, s) + btn.textContent + c.input.value.slice(end);
        c.input.focus();
        c.input.setSelectionRange(s + 1, s + 1);
        c.input.dispatchEvent(new Event("input"));
      });
      c.say.addEventListener("click", () => { if (c.prob && c.prob.say) speak(c.prob.say); });
      return c;
    }

    function paint(c, prob, topic){
      c.prob = prob;
      if (prob.promptHtml) c.problem.innerHTML = prob.promptHtml;
      else c.problem.textContent = prob.prompt;
      c.problem.classList.toggle("long", (prob.prompt || c.problem.textContent).length > 34);
      c.say.hidden = !canPlay(prob.say) || !!prob.sayAfter;
      const hasChoices = !!prob.choices;
      c.choices.hidden = !hasChoices;
      c.answerRow.hidden = hasChoices;
      c.choices.innerHTML = "";
      c.choices.classList.toggle("wide", hasChoices && prob.choices.some(v => v.length > 16));
      if (hasChoices) prob.choices.forEach((value, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.dataset.value = value;
        b.innerHTML = `<span class="choice-n mono">${i + 1}</span><span class="choice-t"></span>`;
        b.querySelector(".choice-t").textContent = value;
        c.choices.appendChild(b);
      });
      c.keys.hidden = hasChoices || !prob.keys;
      c.keys.innerHTML = "";
      (prob.keys || []).forEach(k => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn ghost small";
        b.textContent = k;
        c.keys.appendChild(b);
      });
      c.input.value = "";
      c.input.disabled = false;
      c.input.inputMode = inputModeFor(topic);
      c.check.disabled = false;
    }

    function lock(c, picked){
      c.input.disabled = true;
      c.check.disabled = true;
      c.choices.querySelectorAll("button.choice").forEach(b => {
        b.disabled = true;
        if (c.prob.check(b.dataset.value)) b.classList.add("right");
        else if (b.dataset.value === picked) b.classList.add("wrong");
      });
      if (canPlay(c.prob.say)) c.say.hidden = false;
    }

    function focusCard(c){ if (!c.prob || !c.prob.choices) c.input.focus(); }

    const practice = cardRefs("p-", submitAnswer);
    const trial = cardRefs("t-", submitTrialAnswer);

    // number keys 1–4 tap the answer buttons
    document.addEventListener("keydown", e => {
      if (!isOpen || e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === "INPUT") return;
      const c = trialActive ? trial : practice;
      if (c.choices.hidden) return;
      const btn = c.choices.querySelectorAll("button.choice")[parseInt(e.key, 10) - 1];
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    });


    /* ---------------- mistake review: missed questions come back after 1, 3 and 7 days ---------------- */
    const DAY = 864e5, REVIEW_GAPS = [1, 3, 7], MAX_MISSED = 40;
    const dueItems = () => d.missed.filter(m => m.due <= Date.now());
    function missedKey(prob, topicId){ return topicId + "|" + (prob.prompt || prob.promptHtml); }
    function remember(prob, topicId){
      const key = missedKey(prob, topicId);
      const old = d.missed.find(m => m.key === key);
      if (old) { old.step = 0; old.due = Date.now() + DAY; return; }
      d.missed.push({
        key, topic: topicId, step: 0, due: Date.now() + DAY,
        prompt: prob.prompt, promptHtml: prob.promptHtml, hint: prob.hint || "",
        choices: prob.choices, keys: prob.keys, accepts: prob.accepts,
        answerDisplay: prob.answerDisplay, explainHtml: prob.explain(),
        say: typeof prob.say === "object" ? prob.say : undefined
      });
      if (d.missed.length > MAX_MISSED) d.missed.shift();
    }
    // a saved question can't keep its check function, so rebuild one from what was saved
    function rebuild(m){
      const num = x => { const n = parseFloat(String(x).replace(",", ".")); return isNaN(n) ? null : n; };
      const same = (a, b) => num(a) !== null && num(b) !== null ? Math.abs(num(a) - num(b)) < 1e-9 : norm(a) === norm(b);
      return {
        prompt: m.prompt, promptHtml: m.promptHtml, hint: m.hint, choices: m.choices, keys: m.keys, say: m.say,
        check: m.choices ? v => v === m.answerDisplay : v => m.accepts ? m.accepts.includes(norm(v)) : same(v, m.answerDisplay),
        explain: () => m.explainHtml, answerDisplay: m.answerDisplay
      };
    }
    function reviewed(correct){
      const m = reviewItem;
      if (correct && m.step + 1 >= REVIEW_GAPS.length) d.missed.splice(d.missed.indexOf(m), 1);
      else if (correct) { m.step++; m.due = Date.now() + REVIEW_GAPS[m.step] * DAY; }
      else { m.step = 0; m.due = Date.now() + DAY; }
    }
    function renderReviewBtn(){
      const n = dueItems().length;
      $.reviewBtn.hidden = !n && !reviewItem;
      $.reviewBtn.textContent = reviewItem ? "✕ Stop review" : `🔁 Review mistakes (${n})`;
    }
    $.reviewBtn.addEventListener("click", () => {
      reviewItem = reviewItem ? null : dueItems()[0] || null;
      newProblem();
    });

    /* ---------------- render: topic nav (number line) ---------------- */
    function ringSvg(pct){
      const r = 8, circ = 2 * Math.PI * r;
      const dash = circ * Math.max(0, Math.min(1, pct));
      return `<svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="${r}" fill="none" stroke="var(--line)" stroke-width="2.5"></circle>
        <circle cx="10" cy="10" r="${r}" fill="none" stroke="var(--accent2)" stroke-width="2.5"
          stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" stroke-linecap="round"
          transform="rotate(-90 10 10)"></circle>
      </svg>`;
    }
    function renderTopicNav(){
      $.topicTrack.innerHTML = "";
      TOPICS.forEach(t => {
        const s = d.topics[t.id];
        const pct = s.attempted > 0 ? s.correct / s.attempted : 0;
        const btn = document.createElement("button");
        btn.className = "tick-btn";
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(t.id === currentTopicId));
        btn.innerHTML = `<span class="ring">${ringSvg(pct)}</span><span class="mark"></span><span class="label"></span>`;
        btn.querySelector(".label").textContent = t.label;
        btn.addEventListener("click", () => {
          currentTopicId = t.id;
          currentMode = currentModeFor(t);
          d.topic = t.id;
          Hub.saveStore();
          renderTopicNav();
          renderModeSeg();
          updateTrialBestDisplay();
          newProblem();
        });
        $.topicTrack.appendChild(btn);
      });
    }

    function renderModeSeg(){
      const topic = topicNow();
      if (!topic.modes) { $.modeRow.hidden = true; $.modeSeg.innerHTML = ""; return; }
      $.modeRow.hidden = false;
      $.modeSeg.innerHTML = "";
      topic.modes.forEach(m => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = m.label;
        btn.setAttribute("aria-pressed", String(m.id === currentMode));
        btn.addEventListener("click", () => {
          currentMode = m.id;
          d.modes[topic.id] = m.id;
          Hub.saveStore();
          renderModeSeg();
          newProblem();
        });
        $.modeSeg.appendChild(btn);
      });
    }

    function renderLevelSeg(){
      $.levelSeg.innerHTML = "";
      LEVELS.forEach(l => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = l.label;
        btn.setAttribute("aria-pressed", String(l.id === currentLevel));
        btn.addEventListener("click", () => { currentLevel = l.id; d.level = l.id; Hub.saveStore(); renderLevelSeg(); updateTrialBestDisplay(); newProblem(); });
        $.levelSeg.appendChild(btn);
      });
      $.levelDesc.textContent = topicNow().levelDesc[currentLevel];
    }

    function renderLedger(){
      $.stAttempted.textContent = String(sessionAttempted);
      $.stAccuracy.textContent = sessionAttempted > 0 ? Math.round((sessionCorrect / sessionAttempted) * 100) + "%" : "—";
      $.stStreak.textContent = String(d.streak);
      $.stBest.textContent = String(d.best);
    }

    function inputModeFor(topic){
      return topic.inputMode || "text";
    }

    function newProblem(){
      if (reviewItem) {
        reviewItem = dueItems().find(m => m.topic === currentTopicId) || dueItems()[0] || null;
        if (reviewItem && reviewItem.topic !== currentTopicId) { currentTopicId = reviewItem.topic; d.topic = currentTopicId; renderTopicNav(); }
      }
      const topic = topicNow();
      $.topicTitle.textContent = topic.title;
      $.levelDesc.textContent = topic.levelDesc[currentLevel];
      currentProblem = reviewItem ? rebuild(reviewItem) : topic.generate(currentLevel, currentMode);
      renderReviewBtn();
      if (scene) scene.topic(topic.id);
      answered = false;
      paint(practice, currentProblem, topic);
      $.hintText.textContent = currentProblem.hint || topic.hint;
      $.feedback.className = "feedback";
      $.nextBtn.disabled = true;
      focusCard(practice);
    }

    function submitAnswer(val){
      if (answered) { newProblem(); return; }
      if (!val) { practice.input.focus(); return; }
      const correct = currentProblem.check(val);
      answered = true;
      sessionAttempted++;
      const ts = d.topics[currentTopicId];
      ts.attempted++;
      daily(d, correct);
      if (reviewItem) reviewed(correct);
      else if (!correct) remember(currentProblem, currentTopicId);
      if (correct) {
        sessionCorrect++; ts.correct++;
        d.streak++; if (d.streak > d.best) d.best = d.streak;
        if (currentLevel === "challenge") d.challengeCorrect++;
        $.feedback.className = "feedback show correct";
        $.verdict.textContent = verdicts.right;
        Hub.confettiBurst(currentProblem.choices ? practice.choices : practice.check);
      } else {
        d.streak = 0;
        $.feedback.className = "feedback show incorrect";
        $.verdict.textContent = `${verdicts.wrong} ${currentProblem.answerDisplay}.`;
      }
      $.explain.innerHTML = currentProblem.explain();
      lock(practice, val);
      if (scene) scene.answer(correct, d.streak);
      if (!raceStarted && !raceLocked) raceStarted = true;
      raceStep(correct);
      Hub.checkBadges();
      Hub.saveStore();
      renderLedger();
      renderTopicNav();
      renderReviewBtn();
      if (reviewItem) $.verdict.textContent += correct ? " It will come back later." : " Let's try it again tomorrow.";
      $.nextBtn.disabled = false;
      $.nextBtn.focus();
    }

    $.nextBtn.addEventListener("click", newProblem);

    function updateNameDisplay(){
      $.kidName.textContent = store.name ? store.name : cfg.nameFallback;
    }

    $.resetBtn.addEventListener("click", () => {
      if (!confirm(`Clear all saved ${cfg.subject} progress on this device? This also takes your ${cfg.subject} trophies off the shelf. Other scores stay.`)) return;
      TOPICS.forEach(t => { d.topics[t.id] = { attempted: 0, correct: 0 }; });
      d.streak = 0; d.best = 0;
      d.race = { you: 0, rival: 0 }; d.racesWon = 0; d.challengeCorrect = 0; d.trialBest = {}; d.missed = []; reviewItem = null;
      BADGES.forEach(b => { delete store.badges[b.id]; });
      sessionAttempted = 0; sessionCorrect = 0;
      Hub.saveStore();
      renderTopicNav(); renderLedger(); renderRace(); updateTrialBestDisplay();
      raceStarted = false; setRaceMsg(WAITING_MSG);
    });

    /* ---------------- time trial ---------------- */
    const TRIAL_LENGTH = 16;
    const TRIAL_SECONDS = 120;
    const TIER_INFO = {
      1: { cls: "tier1", label: "Outstanding!" },
      2: { cls: "tier2", label: "Great job!" },
      3: { cls: "tier3", label: "Good try" },
      4: { cls: "tier4", label: "Keep practicing" }
    };
    function tierFor(correct){
      if (correct >= 15) return 1;
      if (correct >= 11) return 2;
      if (correct >= 6) return 3;
      return 4;
    }

    let trialActive = false;
    let trialIndex = 0;
    let trialCorrect = 0;
    let trialTimeLeft = TRIAL_SECONDS;
    let trialTimerId = null;
    let trialAdvanceTimeout = null;
    let trialAnswered = false;

    function trialBestKey(){ return currentTopicId + ":" + currentLevel; }
    function updateTrialBestDisplay(){
      const best = d.trialBest[trialBestKey()];
      $.trialBestText.textContent = typeof best === "number" ? `Best: ${best}/${TRIAL_LENGTH}` : "";
    }

    function updateTrialTimerDisplay(){
      $.trialTimer.textContent = Hub.formatTime(trialTimeLeft);
      $.trialTimer.classList.toggle("low", trialTimeLeft <= 10);
    }

    function setPracticeHidden(hidden){
      [$.topicNav, $.levelRow, $.trialRow, $.practicePage, $.ledgerSection, $.raceSection].forEach(el => { el.hidden = hidden; });
      if (hidden) $.modeRow.hidden = true; else renderModeSeg();
      $.trialPage.hidden = !hidden;
    }

    function startTimeTrial(){
      trialActive = true;
      trialIndex = 0;
      trialCorrect = 0;
      trialTimeLeft = TRIAL_SECONDS;
      setPracticeHidden(true);
      $.trialQuiz.hidden = false;
      $.trialResults.hidden = true;

      updateTrialTimerDisplay();
      if (trialTimerId) clearInterval(trialTimerId);
      trialTimerId = setInterval(() => {
        trialTimeLeft--;
        if (trialTimeLeft <= 0) { trialTimeLeft = 0; updateTrialTimerDisplay(); endTimeTrial(); return; }
        updateTrialTimerDisplay();
      }, 1000);

      nextTrialQuestion();
    }

    function nextTrialQuestion(){
      if (trialIndex >= TRIAL_LENGTH) { endTimeTrial(); return; }
      const topic = topicNow();
      trialAnswered = false;
      $.trialQuestionCounter.textContent = `Question ${trialIndex + 1} of ${TRIAL_LENGTH}`;
      $.trialProgressFill.style.width = (trialIndex / TRIAL_LENGTH * 100) + "%";
      paint(trial, topic.generate(currentLevel, currentMode), topic);
      $.trialQuickFeedback.textContent = "";
      $.trialQuickFeedback.className = "trial-quick";
      focusCard(trial);
    }

    function submitTrialAnswer(val){
      if (!trialActive || trialAnswered) return;
      if (!val) { trial.input.focus(); return; }
      const correct = trial.prob.check(val);
      daily(d, correct);
      trialAnswered = true;
      trialIndex++;
      if (correct) {
        trialCorrect++;
        $.trialQuickFeedback.textContent = "✓ " + verdicts.right.replace(/!$/, "");
        $.trialQuickFeedback.className = "trial-quick correct";
        Hub.confettiBurst(trial.prob.choices ? trial.choices : trial.check);
      } else {
        $.trialQuickFeedback.textContent = "✗ " + trial.prob.answerDisplay;
        $.trialQuickFeedback.className = "trial-quick incorrect";
      }
      lock(trial, val);
      if (scene) scene.answer(correct, 0);
      $.trialProgressFill.style.width = (trialIndex / TRIAL_LENGTH * 100) + "%";
      if (trialAdvanceTimeout) clearTimeout(trialAdvanceTimeout);
      // word answers get a little longer, so there's time to read the right one
      trialAdvanceTimeout = setTimeout(() => {
        if (!trialActive) return;
        nextTrialQuestion();
      }, cfg.wordy && !correct ? 1400 : 650);
    }

    function endTimeTrial(){
      if (!trialActive) return;
      trialActive = false;
      if (trialTimerId) { clearInterval(trialTimerId); trialTimerId = null; }
      if (trialAdvanceTimeout) { clearTimeout(trialAdvanceTimeout); trialAdvanceTimeout = null; }
      trial.input.disabled = true;
      trial.check.disabled = true;
      showTrialResults();
    }

    function showTrialResults(){
      const info = TIER_INFO[tierFor(trialCorrect)];
      $.trialQuiz.hidden = true;
      $.trialRatingLabel.textContent = info.label;
      $.trialScore.textContent = `${trialCorrect} / ${TRIAL_LENGTH} correct`;
      $.trialResults.className = "rating-card " + info.cls;
      $.trialResults.hidden = false;

      const key = trialBestKey();
      if (!(key in d.trialBest) || trialCorrect > d.trialBest[key]) {
        d.trialBest[key] = trialCorrect;
        Hub.saveStore();
      }
      updateTrialBestDisplay();
      Hub.checkBadges();
    }

    function exitTimeTrial(){
      trialActive = false;
      if (trialTimerId) { clearInterval(trialTimerId); trialTimerId = null; }
      if (trialAdvanceTimeout) { clearTimeout(trialAdvanceTimeout); trialAdvanceTimeout = null; }
      setPracticeHidden(false);
    }

    $.timeTrialBtn.addEventListener("click", startTimeTrial);
    $.trialExitBtn.addEventListener("click", exitTimeTrial);
    $.trialRetryBtn.addEventListener("click", startTimeTrial);
    $.trialBackBtn.addEventListener("click", exitTimeTrial);

    /* ---------------- race: every right answer moves your car ---------------- */
    const RACE_STEPS = 10;
    const CAR_SVG = `<svg viewBox="0 0 60 28" aria-hidden="true"><g transform="translate(60,0) scale(-1,1)">
      <rect x="53" y="6" width="2.5" height="7" fill="#0a0c11"/>
      <rect x="49" y="3" width="10" height="3.5" rx="1" fill="currentColor" stroke="#0a0c11" stroke-width="1.2"/>
      <path d="M2 21 L2 17 C2 15 4 14 7 14 L14 13 C18 8 24 6 32 6 L38 6 C44 7 48 10 51 13 L56 15 C58 16 58 18 58 20 L58 21 Z"
        fill="currentColor" stroke="#0a0c11" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M18 13 C21 9 26 8 31 8 L37 8 C41 9 44 11 46 13 Z" fill="#9fdde0" stroke="#0a0c11" stroke-width="1"/>
      <circle cx="14" cy="21" r="5.5" fill="#15161b"/><circle cx="14" cy="21" r="2.2" fill="#c9ced8"/>
      <circle cx="46" cy="21" r="5.5" fill="#15161b"/><circle cx="46" cy="21" r="2.2" fill="#c9ced8"/>
    </g></svg>`;
    $.carYou.innerHTML = CAR_SVG;
    $.carRival.innerHTML = CAR_SVG;

    function placeCar(car, steps){
      // start at the left edge, stop with the nose touching the finish line
      car.style.left = `calc(4px + (100% - 74px) * ${steps / RACE_STEPS})`;
    }
    function renderRace(){
      placeCar($.carYou, d.race.you);
      placeCar($.carRival, d.race.rival);
    }
    function setRaceMsg(text, cls){
      $.raceMsg.textContent = text;
      $.raceMsg.className = "race-msg" + (cls ? " " + cls : "");
    }
    // Robo, the AI rival, drives one step every few seconds while you think.
    const ROBO_DRIVERS = [
      { id: "easy",   label: "🐢 Easy",   secs: 10 },
      { id: "medium", label: "🚗 Medium", secs: 8 },
      { id: "hard",   label: "🚀 Hard",   secs: 5 }
    ];
    let roboSecs = 0;        // seconds since Robo's last step
    let raceLocked = false;  // short pause after someone wins
    let raceStarted = false; // Robo waits until you start answering
    const WAITING_MSG = "Start answering and Robo will go! 🤖";

    function renderRoboSeg(){
      $.roboSeg.innerHTML = "";
      ROBO_DRIVERS.forEach(drv => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = drv.label;
        btn.setAttribute("aria-pressed", String(drv.id === d.robo));
        btn.addEventListener("click", () => { d.robo = drv.id; Hub.saveStore(); renderRoboSeg(); });
        $.roboSeg.appendChild(btn);
      });
    }

    function bump(car){ car.classList.remove("zoom"); void car.offsetWidth; car.classList.add("zoom"); }

    function newRace(){
      d.race = { you: 0, rival: 0 };
      roboSecs = 0;
      raceStarted = false;
      raceLocked = true;
      setTimeout(() => { raceLocked = false; renderRace(); setRaceMsg(WAITING_MSG); }, 1600);
    }

    function checkFinish(){
      if (d.race.you >= RACE_STEPS) {
        d.racesWon++;
        setRaceMsg(`🏆 You beat Robo! Race #${d.racesWon} won!`, "win");
        Hub.confettiBurst($.carYou); Hub.confettiBurst($.carYou);
        newRace();
        return true;
      }
      if (d.race.rival >= RACE_STEPS) {
        setRaceMsg("🤖 Robo got there first. New race, go go go!", "lose");
        newRace();
        return true;
      }
      return false;
    }

    function raceStep(correct){
      if (!correct || raceLocked) return;
      d.race.you++;
      renderRace();
      bump($.carYou);
      if (!checkFinish()) {
        const left = RACE_STEPS - d.race.you;
        setRaceMsg(`Vroom! ${left} more to the finish.`);
      }
    }

    function roboTick(){
      if (!raceStarted || raceLocked || answered || trialActive || !isOpen || document.hidden || $.raceSection.hidden) return;
      const driver = ROBO_DRIVERS.find(drv => drv.id === d.robo) || ROBO_DRIVERS[0];
      if (++roboSecs < driver.secs) return;
      roboSecs = 0;
      d.race.rival++;
      renderRace();
      bump($.carRival);
      if (!checkFinish()) {
        if (d.race.rival > d.race.you) setRaceMsg("🤖 Robo is pulling ahead!");
        else if (d.race.rival === d.race.you) setRaceMsg("Neck and neck!");
      }
      Hub.saveStore();
    }
    setInterval(roboTick, 1000);

    practice.input.addEventListener("input", () => {
      if (raceStarted || raceLocked) return;
      raceStarted = true;
      setRaceMsg("🚦 Go go go!");
    });

    $.raceRestartBtn.addEventListener("click", () => {
      d.race = { you: 0, rival: 0 };
      roboSecs = 0;
      raceStarted = false;
      raceLocked = false;
      Hub.saveStore();
      renderRace();
      setRaceMsg(WAITING_MSG);
      focusCard(practice);
    });

    /* ---------------- boot ---------------- */
    renderTopicNav();
    renderLevelSeg();
    renderModeSeg();
    renderLedger();
    updateTrialBestDisplay();
    renderRace();
    renderRoboSeg();
    setRaceMsg(WAITING_MSG);
    newProblem();

    function open(){
      isOpen = true;
      if (scene) scene.open();
      updateNameDisplay();
      renderTopicNav();
      if (trialActive) focusCard(trial);
      else if (answered) $.nextBtn.focus();
      else focusCard(practice);
    }
    function close(){
      isOpen = false;
      if (scene) scene.close();
      if (trialActive) exitTimeTrial();
      if (canSpeak) speechSynthesis.cancel();
    }
    return { open, close };
  }

  window.Notebook = { register, pick, typed, norm, shuffle, sample, choice, subjects };
})();
