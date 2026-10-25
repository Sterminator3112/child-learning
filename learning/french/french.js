/* Français Fusée: the first year of French, in 5th grade in Switzerland (Lehrplan 21, where French starts
   in the 5th class). Hello and goodbye, numbers (with the Swiss septante, huitante, nonante), colours and
   animals, le / la / l', être and avoir, and the -er verbs. The questions are in German, like at school,
   with a 🔊 button that reads the French out loud. Swiss spelling in the German: ss, never ß. */
(function(){
  "use strict";
  const { pick, typed, sample, choice } = Notebook;
  const say = text => ({ text, lang: "fr-FR" });
  const KEYS = ["é", "è", "ê", "à", "ç"];
  // typed French counts without accents or hyphens too
  const loose = s => [s, s.replace(/-/g, " "), s.normalize("NFD").replace(/[̀-ͯ]/g, ""), s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/-/g, " ")];

  /* ---------------- Bonjour! [what you say, when you say it (German), the French] ---------------- */
  const PHRASES = {
    warmup: [
      ["Du triffst am Morgen deine Lehrerin.", "Bonjour, madame !"], ["Du triffst deinen Freund.", "Salut !"],
      ["Du gehst nach Hause.", "Au revoir !"], ["Jemand gibt dir etwas.", "Merci !"],
      ["Du möchtest etwas, bitte!", "S'il te plaît."], ["Du willst wissen, wie es geht.", "Ça va ?"],
      ["Es geht dir gut.", "Ça va bien, merci."], ["Du sagst deinen Namen.", "Je m'appelle Lea."],
      ["Am Abend gehst du schlafen.", "Bonne nuit !"], ["Du siehst deinen Freund morgen wieder.", "À demain !"]
    ],
    practice: [
      ["Du willst wissen, wie jemand heisst.", "Comment tu t'appelles ?"], ["Du willst wissen, wie alt jemand ist.", "Tu as quel âge ?"],
      ["Du sagst, dass du elf bist.", "J'ai onze ans."], ["Du sagst, wo du wohnst.", "J'habite à Baar."],
      ["Du willst wissen, wo jemand wohnt.", "Tu habites où ?"], ["Du hast etwas nicht verstanden.", "Je ne comprends pas."],
      ["Du möchtest, dass die Lehrerin es wiederholt.", "Vous pouvez répéter, s'il vous plaît ?"],
      ["Du hast jemanden angerempelt.", "Pardon !"], ["Du sagst, dass es dir nicht so gut geht.", "Ça ne va pas."],
      ["Du freust dich, jemanden kennenzulernen.", "Enchanté !"]
    ],
    challenge: [
      ["Du sagst, was du gern machst.", "J'aime jouer au foot."], ["Du willst wissen, was jemand gern macht.", "Qu'est-ce que tu aimes ?"],
      ["Du willst wissen, wann jemand Geburtstag hat.", "C'est quand, ton anniversaire ?"],
      ["Du sagst, dass du Geschwister hast.", "J'ai un frère et une sœur."], ["Du willst wissen, wie spät es ist.", "Il est quelle heure ?"],
      ["Du willst wissen, was das ist.", "Qu'est-ce que c'est ?"], ["Du sagst, welche Sprache du sprichst.", "Je parle allemand."],
      ["Du gratulierst zum Geburtstag.", "Joyeux anniversaire !"], ["Du wünschst einen schönen Tag.", "Bonne journée !"],
      ["Du sagst, dass du Hunger hast.", "J'ai faim."]
    ]
  };
  function phraseQuestion(level){
    const list = PHRASES[level], p = choice(list);
    const others = sample(list.filter(o => o !== p), 3).map(o => o[1]);
    return pick({
      promptHtml: `${p[0]}<span class="sub">Was sagst du auf Französisch?</span>`, prompt: p[0],
      answer: p[1], options: [p[1], ...others], say: say(p[1]), sayAfter: true,
      explain: `<b>${p[1]}</b><br>💡 Drück auf 🔊 und sprich es nach!`
    });
  }

  /* ---------------- Les nombres ---------------- */
  const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const TENS = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };
  // the French from France: soixante-dix, quatre-vingts, quatre-vingt-dix
  function nombre(n){
    if (n < 20) return UNITS[n];
    if (n === 100) return "cent";
    if (n < 70) { const t = TENS[Math.floor(n / 10)], u = n % 10; return u === 0 ? t : u === 1 ? t + " et un" : t + "-" + UNITS[u]; }
    if (n < 80) return n === 71 ? "soixante et onze" : "soixante-" + UNITS[n - 60];
    return n === 80 ? "quatre-vingts" : "quatre-vingt-" + UNITS[n - 80];
  }
  // the French in Switzerland: septante, huitante, nonante
  function nombreSuisse(n){
    if (n < 70 || n === 100) return nombre(n);
    const t = ["septante", "huitante", "nonante"][Math.floor(n / 10) - 7], u = n % 10;
    return u === 0 ? t : u === 1 ? t + " et un" : t + "-" + UNITS[u];
  }
  const NUM_RANGE = { warmup: [0, 20], practice: [21, 69], challenge: [70, 100] };
  function numberQuestion(level, mode){
    const [lo, hi] = NUM_RANGE[level], rnd = () => lo + Math.floor(Math.random() * (hi - lo + 1));
    const n = rnd(), others = new Set();
    while (others.size < 3) { const m = rnd(); if (m !== n) others.add(m); }
    const swiss = n >= 70 && n < 100;
    const explain = `<b>${n}</b> = <b>${nombre(n)}</b>` + (swiss ? `<br>🇨🇭 In der Westschweiz sagt man auch: <b>${nombreSuisse(n)}</b>` : "")
      + (n > 20 && n < 70 ? "<br>💡 Zuerst die Zehner, dann die Einer: " + TENS[Math.floor(n / 10)] + " + " + UNITS[n % 10] : "");
    if (mode === "write") {
      return typed({
        prompt: `Schreib ${n} auf Französisch.`, answers: [nombre(n), nombreSuisse(n)].flatMap(loose), answerDisplay: nombre(n),
        keys: KEYS, say: say(nombre(n)), sayAfter: true, hint: "Bindestriche und Akzente musst du nicht tippen.", explain
      });
    }
    if (mode === "read") {
      return pick({ promptHtml: `«${nombre(n)}»<span class="sub">Welche Zahl ist das?</span>`, prompt: nombre(n), say: say(nombre(n)),
                    answer: String(n), options: [n, ...others].map(String), explain });
    }
    return pick({ promptHtml: `<b>${n}</b><span class="sub">Wie sagt man das auf Französisch?</span>`, prompt: String(n),
                  say: say(nombre(n)), sayAfter: true, answer: nombre(n), options: [n, ...others].map(nombre), explain });
  }

  /* ---------------- words: [French with its article, German, emoji] ---------------- */
  const WORDS = {
    warmup: [ // colours and animals
      ["rouge", "rot", "🔴"], ["bleu", "blau", "🔵"], ["vert", "grün", "🟢"], ["jaune", "gelb", "🟡"], ["noir", "schwarz", "⚫"],
      ["blanc", "weiss", "⚪"], ["orange", "orange", "🟠"], ["violet", "violett", "🟣"], ["rose", "rosa", "🌸"], ["brun", "braun", "🟤"],
      ["le chien", "der Hund", "🐶"], ["le chat", "die Katze", "🐱"], ["le cheval", "das Pferd", "🐴"], ["la vache", "die Kuh", "🐮"],
      ["l'oiseau", "der Vogel", "🐦"], ["le poisson", "der Fisch", "🐟"], ["la souris", "die Maus", "🐭"], ["le lapin", "das Kaninchen", "🐰"]
    ],
    practice: [ // school and family
      ["le crayon", "der Bleistift", "✏️"], ["la gomme", "der Radiergummi", "🧽"], ["le livre", "das Buch", "📕"], ["le cahier", "das Heft", "📓"],
      ["la règle", "das Lineal", "📏"], ["les ciseaux", "die Schere", "✂️"], ["le sac d'école", "der Schulsack", "🎒"], ["l'école", "die Schule", "🏫"],
      ["la mère", "die Mutter", "👩"], ["le père", "der Vater", "👨"], ["le frère", "der Bruder", "👦"], ["la sœur", "die Schwester", "👧"],
      ["la grand-mère", "die Grossmutter", "👵"], ["le grand-père", "der Grossvater", "👴"], ["l'ami", "der Freund", "🧑‍🤝‍🧑"], ["la famille", "die Familie", "👨‍👩‍👧‍👦"]
    ],
    challenge: [ // food, clothes and the body
      ["le pain", "das Brot", "🍞"], ["le fromage", "der Käse", "🧀"], ["la pomme", "der Apfel", "🍎"], ["le croissant", "das Gipfeli", "🥐"],
      ["le chocolat", "die Schokolade", "🍫"], ["l'eau", "das Wasser", "💧"], ["la glace", "die Glace", "🍦"], ["le lait", "die Milch", "🥛"],
      ["le pull", "der Pullover", "🧶"], ["la chaussure", "der Schuh", "👟"], ["le pantalon", "die Hose", "👖"], ["la casquette", "die Mütze", "🧢"],
      ["la tête", "der Kopf", "🙂"], ["la main", "die Hand", "✋"], ["le pied", "der Fuss", "🦶"], ["le nez", "die Nase", "👃"]
    ]
  };
  const bare = w => w.replace(/^(le |la |les |l')/, "");
  function wordQuestion(level, mode){
    const list = WORDS[level], w = choice(list);
    const others = sample(list.filter(o => o !== w), 3);
    const explain = `${w[2]} <b>${w[0]}</b> = ${w[1]}`;
    if (mode === "de2fr" && level === "challenge") {
      return typed({
        prompt: `${w[2]} Was heisst «${w[1]}» auf Französisch?`, answers: [w[0], bare(w[0])].flatMap(loose), answerDisplay: w[0],
        keys: KEYS, say: say(w[0]), sayAfter: true, hint: "Mit oder ohne le / la.", explain
      });
    }
    return mode === "de2fr"
      ? pick({ prompt: `${w[2]} Was heisst «${w[1]}» auf Französisch?`, say: say(w[0]), sayAfter: true,
               answer: w[0], options: [w[0], ...others.map(o => o[0])], explain })
      : pick({ prompt: `Was heisst «${w[0]}»?`, say: say(w[0]),
               answer: w[1], options: [w[1], ...others.map(o => o[1])], explain });
  }

  /* ---------------- le, la or l'? [word without article, article, German] ---------------- */
  const GENDER = {
    warmup: [["chien", "le", "Hund"], ["chat", "le", "Katze"], ["maison", "la", "Haus"], ["pomme", "la", "Apfel"], ["livre", "le", "Buch"],
      ["table", "la", "Tisch"], ["vélo", "le", "Velo"], ["voiture", "la", "Auto"], ["soleil", "le", "Sonne"], ["lune", "la", "Mond"],
      ["fille", "la", "Mädchen"], ["garçon", "le", "Junge"]],
    practice: [["école", "l'", "Schule"], ["ami", "l'", "Freund"], ["oiseau", "l'", "Vogel"], ["eau", "l'", "Wasser"], ["arbre", "l'", "Baum"],
      ["fenêtre", "la", "Fenster"], ["porte", "la", "Tür"], ["crayon", "le", "Bleistift"], ["gomme", "la", "Radiergummi"],
      ["train", "le", "Zug"], ["montagne", "la", "Berg"], ["lac", "le", "See"]],
    challenge: [["fromage", "le", "Käse"], ["chaise", "la", "Stuhl"], ["animal", "l'", "Tier"], ["mer", "la", "Meer"], ["fleur", "la", "Blume"],
      ["lit", "le", "Bett"], ["orange", "l'", "Orange"], ["chocolat", "le", "Schokolade"], ["neige", "la", "Schnee"],
      ["hôpital", "l'", "Spital"], ["ordinateur", "l'", "Computer"], ["semaine", "la", "Woche"]]
  };
  function genderQuestion(level){
    const [word, art, de] = choice(GENDER[level]);
    const full = art === "l'" ? "l'" + word : art + " " + word;
    const tip = art === "l'" ? "Das Wort fängt mit einem Vokal (a, e, i, o, u) oder einem stummen h an, darum wird le / la zu <b>l'</b>."
      : art === "le" ? "<b>le</b> ist männlich (masculin)." : "<b>la</b> ist weiblich (féminin).";
    const sneaky = ["Katze", "Haus", "Apfel", "Tisch", "Auto", "Sonne", "Mond", "Mädchen", "Buch", "Velo", "Fenster", "Radiergummi", "Berg", "Stuhl", "Meer", "Bett", "Schokolade", "Schnee"].includes(de)
      ? "<br>😮 Achtung: auf Deutsch ist es anders! Am besten lernst du jedes Wort mit seinem Artikel." : "";
    return pick({
      promptHtml: `___ ${word}<span class="sub">(${de}) – le, la oder l'?</span>`, prompt: `___ ${word}`,
      answer: art, options: level === "warmup" ? ["le", "la"] : ["le", "la", "l'"], keepOrder: true, say: say(full), sayAfter: true,
      explain: `<b>${full}</b> = ${de}<br>💡 ${tip}${sneaky}`
    });
  }

  /* ---------------- verbs: être, avoir and the -er verbs ---------------- */
  const PERSONS = ["je", "tu", "il", "elle", "nous", "vous", "ils", "elles"];
  const SLOT = { je: 0, tu: 1, il: 2, elle: 2, nous: 3, vous: 4, ils: 5, elles: 5 };
  const ETRE = ["suis", "es", "est", "sommes", "êtes", "sont"], AVOIR = ["ai", "as", "a", "avons", "avez", "ont"];
  const ER = [["jouer", "spielen"], ["aimer", "lieben / gern haben"], ["habiter", "wohnen"], ["parler", "sprechen"], ["regarder", "anschauen"],
    ["écouter", "zuhören"], ["chanter", "singen"], ["danser", "tanzen"], ["dessiner", "zeichnen"], ["arriver", "ankommen"]];
  const ER_END = ["e", "es", "e", "ons", "ez", "ent"];
  const vowel = w => /^[aeiouéèêh]/.test(w);
  // je + a vowel becomes j'
  const withPerson = (p, form) => p === "je" && vowel(form) ? "j'" + form : p + " " + form;
  const erForm = (verb, p) => verb.slice(0, -2) + ER_END[SLOT[p]];
  function verbQuestion(level){
    const p = choice(PERSONS);
    if (level === "warmup") {
      const [name, forms, de] = choice([["être", ETRE, "sein"], ["avoir", AVOIR, "haben"]]);
      const right = forms[SLOT[p]], full = withPerson(p, right);
      return pick({
        promptHtml: `${p === "je" && name === "avoir" ? "j'" : p} ___<span class="sub">${name} (${de}) – welche Form passt?</span>`, prompt: `${p} ___ (${name})`,
        answer: right, options: [right, ...sample(forms.filter(f => f !== right), 3)], say: say(full), sayAfter: true,
        explain: `<b>${full}</b><br>💡 ${name}: ${forms.map((f, i) => withPerson(["je", "tu", "il", "nous", "vous", "ils"][i], f)).join(", ")}`
      });
    }
    const [verb, de] = choice(ER), right = erForm(verb, p), full = withPerson(p, right);
    const explain = `<b>${full}</b> (${verb} = ${de})<br>💡 Stamm <b>${verb.slice(0, -2)}</b> + Endung: -e, -es, -e, -ons, -ez, -ent.`
      + (["ils", "elles"].includes(p) ? "<br>🤫 Das -ent hört man nicht!" : "");
    if (level === "practice") {
      const opts = [...new Set([right, ...ER_END.map(e => verb.slice(0, -2) + e)])].filter(f => f !== right);
      return pick({
        promptHtml: `${p === "je" && vowel(verb) ? "j'" : p} ___<span class="sub">${verb} (${de})</span>`, prompt: `${p} ___ (${verb})`,
        answer: right, options: [right, ...sample(opts, 3)], say: say(full), sayAfter: true, explain
      });
    }
    return typed({
      promptHtml: `${p === "je" && vowel(verb) ? "j'" : p} ___<span class="sub">Schreib die richtige Form von «${verb}» (${de}).</span>`, prompt: `${p} ___ (${verb})`,
      answers: loose(right), answerDisplay: right, keys: KEYS, say: say(full), sayAfter: true, hint: "Stamm + Endung", explain
    });
  }

  const TOPICS = [
    {
      id: "bonjour", label: "Bonjour !", icon: "👋", title: "Was sagst du?",
      levelDesc: { warmup: "Hallo, tschüss, danke, bitte", practice: "Sich vorstellen: Name, Alter, Wohnort", challenge: "Hobbys, Geburtstag, Familie" },
      hint: "Drück nach der Antwort auf 🔊 und sprich nach.",
      generate: phraseQuestion
    },
    {
      id: "nombres", label: "Les nombres", icon: "🔢", title: "Zählen auf Französisch",
      levelDesc: { warmup: "0 bis 20", practice: "21 bis 69", challenge: "70 bis 100 – mit septante, huitante, nonante" },
      hint: "Zuerst die Zehner, dann die Einer.",
      modes: [{ id: "say", label: "Zahl → Wort" }, { id: "read", label: "Wort → Zahl" }, { id: "write", label: "✍️ Schreiben" }],
      generate: numberQuestion
    },
    {
      id: "mots", label: "Les mots", icon: "🐶", title: "Wörter lernen",
      levelDesc: { warmup: "Farben und Tiere", practice: "Schule und Familie", challenge: "Essen, Kleider, Körper" },
      hint: "Lern jedes Wort mit le oder la.",
      modes: [{ id: "fr2de", label: "Français → Deutsch" }, { id: "de2fr", label: "Deutsch → Français" }],
      generate: wordQuestion
    },
    {
      id: "genre", label: "le, la, l'", icon: "⚖️", title: "Männlich oder weiblich?",
      levelDesc: { warmup: "le oder la?", practice: "…dazu l' vor einem Vokal", challenge: "Schwierige Wörter" },
      hint: "Vor a, e, i, o, u wird le / la zu l'.",
      generate: genderQuestion
    },
    {
      id: "verbes", label: "Les verbes", icon: "🏃", title: "Verben konjugieren",
      levelDesc: { warmup: "être und avoir", practice: "Verben auf -er", challenge: "Verben auf -er selber schreiben" },
      hint: "je, tu, il / elle, nous, vous, ils / elles",
      generate: verbQuestion
    }
  ];

  const store = Hub.store;
  if (!store.french) store.french = {};

  Notebook.register({
    id: "french", title: "Français Fusée", icon: "🥐",
    blurb: "Dein erstes Jahr Französisch: Bonjour, Zahlen, Wörter, le / la und Verben – mit 🔊 zum Nachsprechen.",
    unit: "/// un cahier de français",
    tagline: "Französisch für die 5. Klasse, mit 🔊 zum Anhören und einem Tipp zu jeder Antwort",
    taglineFor: "pour",
    nameFallback: "toi",
    subject: "French",
    wordy: true,
    verdicts: { right: "Bravo !", wrong: "Presque ! Richtig ist:" },
    listenLabel: "🔊 Écoute",
    data: store.french,
    badgePrefix: "fr-",
    badgeNames: {
      first: ["⭐", "Bonjour !"], streak5: ["🔥", "Très bien !"], streak10: ["🚀", "Super !"],
      streak25: ["⚡", "Magnifique !"], race1: ["🏁", "Rapide !"], race5: ["🏆", "Champion"],
      race20: ["👑", "Légende"], trial: ["⏱️", "Éclair"], challenge: ["💪", "Costaud !"],
      century: ["💯", "Cent !"]
    },
    topics: TOPICS,
    // the Tour de France above the questions: every right answer and you pedal past the yellow jersey
    scene: el => TourDeFrance(el, store.french.tour = store.french.tour || {})
  });
})();
