/* Tipp-Meister: 10-Finger-Schreiben auf der Schweizer Tastatur (QWERTZ), in 80 Lektionen wie bei Typewriter:
   zuerst die Grundreihe, dann alle Buchstaben, Grossbuchstaben, Zahlen und Zeichen, und zuletzt Sätze und Texte.
   Die nächste Taste leuchtet auf der Bildschirm-Tastatur, in der Farbe des Fingers, der sie drückt.
   Man darf jede Lektion wählen; bestanden ist sie mit höchstens 5 % Fehlern.
   Dazu ein Autorennen in 3D: dein Auto fährt so schnell, wie du tippst, gegen Robo, der im Tempo für 3 Sterne
   fährt. Viele richtige Tasten am Stück geben eine Combo mit Feuer. Die Tasten sinken beim Tippen ein. */
(function(){
  "use strict";
  const store = Hub.store;
  if (!store.typing) store.typing = {};
  const T = store.typing;
  if (!T.best) T.best = {};
  if (!T.lesson) T.lesson = 1;
  const passed = () => Object.keys(T.best).length;

  /* ---------------- die Schweizer Tastatur ---------------- */
  // [Taste, mit Shift, Finger]; Finger 0–3 links (kleiner Finger bis Zeigefinger), 4–7 rechts (Zeigefinger bis kleiner Finger), 8 Daumen
  const ROWS = [
    [["§", "°", 0], ["1", "+", 0], ["2", "\"", 1], ["3", "*", 2], ["4", "ç", 3], ["5", "%", 3], ["6", "&", 4], ["7", "/", 4], ["8", "(", 5], ["9", ")", 6], ["0", "=", 7], ["'", "?", 7], ["^", "`", 7], ["⌫", "", 7, 2]],
    [["⇥", "", 0, 1.5], ["q", "Q", 0], ["w", "W", 1], ["e", "E", 2], ["r", "R", 3], ["t", "T", 3], ["z", "Z", 4], ["u", "U", 4], ["i", "I", 5], ["o", "O", 6], ["p", "P", 7], ["ü", "è", 7], ["¨", "!", 7], ["↵", "", 7, 1.5]],
    [["⇪", "", 0, 1.75], ["a", "A", 0], ["s", "S", 1], ["d", "D", 2], ["f", "F", 3], ["g", "G", 3], ["h", "H", 4], ["j", "J", 4], ["k", "K", 5], ["l", "L", 6], ["ö", "é", 7], ["ä", "à", 7], ["$", "£", 7], ["", "", 7, 1.25]],
    [["⇧", "", 0, 1.25, "shiftL"], ["<", ">", 0], ["y", "Y", 0], ["x", "X", 1], ["c", "C", 2], ["v", "V", 3], ["b", "B", 3], ["n", "N", 4], ["m", "M", 4], [",", ";", 5], [".", ":", 6], ["-", "_", 7], ["⇧", "", 7, 2.75, "shiftR"]],
    [[" ", "", 8, 6.5, "space"]]
  ];
  const FINGERS = ["linker kleiner Finger", "linker Ringfinger", "linker Mittelfinger", "linker Zeigefinger",
    "rechter Zeigefinger", "rechter Mittelfinger", "rechter Ringfinger", "rechter kleiner Finger", "Daumen"];
  // welche Taste (und ob mit Shift) ein Zeichen braucht
  const CHAR = {};
  ROWS.flat().forEach(([k, s, f]) => {
    if (k && k.length === 1) CHAR[k] = { key: k, shift: false, finger: f };
    if (s && s.length === 1) CHAR[s] = { key: k, shift: true, finger: f };
  });

  /* ---------------- Wörter und Texte ---------------- */
  const WOERTER = ("da das als ja sah lag las lass hals fall glas gas kahl saal lahm fass jagd falls halsweh " +
    "der die und ist ein eine ich du er sie es wir ihr mit auf aus bei nach von zu im in am an auch aber oder wenn dann denn noch schon sehr gut viel mehr alle alles hier dort heute morgen gestern immer nie oft jetzt bald gern nein hallo danke bitte " +
    "gross klein lang kurz alt neu jung schnell langsam laut leise hell dunkel warm kalt heiss nass froh lustig still fein dick dünn schön müde stark leicht schwer weich hart süss sauer rot blau grün gelb weiss schwarz braun " +
    "haus hund katze maus baum blume vogel fisch pferd kuh ziege schaf hase igel fuchs wald feld see berg tal fluss meer insel strand sand stein sonne mond stern wolke regen schnee wind eis glas tisch stuhl bett lampe tür fenster buch heft stift blatt schule klasse lehrer pause spiel ball velo zug auto bus schiff boot weg strasse stadt dorf land welt " +
    "kind mama papa oma opa bruder schwester freund name zeit jahr tag woche monat stunde minute uhr essen trinken brot käse milch wasser apfel birne glace suppe salat kuchen " +
    "gehen laufen springen spielen lesen schreiben rechnen malen singen tanzen lachen kaufen holen fragen sagen machen haben sein kommen sehen hören fühlen denken finden suchen geben nehmen helfen bauen fahren fliegen schwimmen tauchen klettern rennen werfen fangen " +
    "ast dach fest gras rad wald ente esel bach gabel affe adler daumen fahne garten tasche wasser zebra vase").split(" ");
  const NOMEN = ["Haus", "Hund", "Katze", "Maus", "Baum", "Blume", "Vogel", "Fisch", "Pferd", "Ziege", "Schaf", "Hase", "Igel", "Fuchs", "Wald", "Feld", "See", "Berg", "Tal", "Fluss",
    "Meer", "Insel", "Strand", "Sonne", "Mond", "Stern", "Wolke", "Regen", "Schnee", "Wind", "Glas", "Tisch", "Stuhl", "Bett", "Lampe", "Buch", "Heft", "Stift", "Schule", "Klasse",
    "Pause", "Ball", "Velo", "Zug", "Auto", "Bus", "Boot", "Weg", "Stadt", "Dorf", "Land", "Kind", "Mama", "Papa", "Oma", "Opa", "Freund", "Name", "Jahr", "Tag", "Uhr", "Brot",
    "Milch", "Wasser", "Apfel", "Birne", "Glace", "Suppe", "Ast", "Dach", "Gras", "Rad", "Ente", "Esel", "Bach", "Gabel", "Affe", "Adler", "Garten", "Tasche", "Zebra", "Vase", "Nase", "Ohr", "Junge", "Pilz"];
  const RIGHT_HAND = new Set([..."zuiophjklnmöäü"]);

  const SAETZE = {
    25: "Der Ball rollt. Die Sonne lacht. Ein Vogel singt im Baum. Der Hund bellt.",
    26: "Mein Velo ist rot. Dein Hund ist braun. Unser Haus ist gross und hell.",
    27: "Ich lese ein Buch. Du malst ein Bild. Wir spielen zusammen im Garten.",
    28: "Im Sommer baden wir im See. Im Winter bauen wir einen grossen Schneemann.",
    29: "Die Katze jagt die Maus. Der Fuchs schleicht leise durch den dunklen Wald.",
    30: "Am Morgen trinke ich Milch. Am Abend lese ich noch ein Kapitel in meinem Buch.",
    33: "Im Jahr 2026 bin ich 11 Jahre alt. Mein Bruder ist 8. Zusammen sind wir 19 Jahre alt.",
    34: "Wie heisst du? Ich heisse Lena! Kommst du mit? Ja, gern! Wann? Jetzt sofort!",
    35: "Einkaufsliste: Brot, Milch, Eier; danach: Spielplatz. Achtung: Die Suppe ist heiss!",
    36: "Sie rief: \"Komm schnell!\" (Es war dringend.) Er sagte: \"Ich komme!\" (Er rannte.)",
    37: "3 + 4 = 7, 9 - 5 = 4, 8 / 2 = 4, 12 - 7 = 5, 6 + 6 = 12, 20 / 4 = 5",
    38: "50 % der Kinder mögen Pizza. Max & Moritz sind Freunde. 3 * 4 = 12 und 25 % von 100 sind 25.",
    39: "Wer? Wie? Was? (Das ist die Frage!) 7 + 3 = 10; 10 - 4 = 6: \"Super!\" rief Mia & Tim.",
    40: "Heute ist der 15.10.2026. Die Schule beginnt um 08:00 Uhr und endet um 15:30 Uhr.",
    41: "Der Hund bellt laut. Die Katze schläft auf dem Sofa. Im Teich schwimmen drei Enten. Der Fuchs schleicht durch den Wald.",
    42: "Am Morgen gehe ich in die Schule. Wir haben heute Mathe, Deutsch und Musik. In der Pause spielen wir Fussball.",
    43: "Ich wohne im Kanton Zug. Der Zugersee ist gross und blau. Vom Zugerberg sieht man bis zu den Alpen.",
    44: "In Baar fliesst die Lorze. Bei den Höllgrotten gibt es Tropfsteine. Mit dem Velo fahre ich zum Schulhaus Sternmatt.",
    45: "Zum Znüni esse ich einen Apfel. Am Mittag gibt es Teigwaren mit Tomatensauce. Am Abend essen wir Raclette.",
    46: "Heute scheint die Sonne. Morgen soll es regnen. Im Winter liegt auf dem Zugerberg oft Schnee.",
    47: "Ich spiele gern Fussball. Meine Schwester schwimmt jeden Mittwoch. Im Winter fahren wir zusammen Ski.",
    48: "Am Strand werfe ich die Angel aus. Ein Fisch beisst an! Ich halte die Rute gut fest und hole ihn langsam ein.",
    49: "Meine Familie ist gross. Ich habe einen Bruder und zwei Cousinen. Am Sonntag besuchen wir Oma und Opa.",
    50: "In den Ferien fahren wir ans Meer. Wir bauen Sandburgen und suchen Muscheln. Am Abend essen wir eine Glace.",
    51: "Das rote Auto fährt schnell um die Kurve. Es springt über eine Rampe und saust durch einen Looping.",
    52: "Die Erde dreht sich um die Sonne. Der Mond leuchtet in der Nacht. Jupiter ist der grösste Planet.",
    53: "Mit zehn Fingern tippe ich schneller. Ich schaue nicht auf die Tastatur. Wer viel übt, wird zum Meister!",
    54: "Im Wald wachsen Buchen, Tannen und Eichen. Ein Specht klopft an einen Baum. Ein Reh springt über den Weg.",
    55: "Ich spiele Gitarre und singe dazu. Die Noten heissen c, d, e, f, g, a und h. Musik macht mich froh.",
    56: "Morgen ist mein Geburtstag. Ich lade sechs Freunde ein. Es gibt einen grossen Schokoladenkuchen mit Kerzen.",
    57: "Die Schweiz hat viele Berge. Das Matterhorn ist sehr bekannt. Auf die Rigi fährt eine Zahnradbahn.",
    58: "Mein Hamster heisst Krümel. Er rennt in seinem Rad und frisst gern Körner. Am Tag schläft er sehr viel.",
    59: "Im Meer leben Haie, Delfine und Quallen. Am Korallenriff schwimmen bunte Fische. Ganz tief unten ist es dunkel.",
    60: "Der Roboter rollt durch das Zimmer. Er sammelt alle Bälle ein und bringt sie in die Kiste. Dann piepst er fröhlich.",
    61: "Wilhelm Tell lebte in Uri. Er musste mit der Armbrust einen Apfel vom Kopf seines Sohnes schiessen. Der Pfeil traf genau in die Mitte des Apfels.",
    62: "Für einen Schokoladenkuchen brauchst du 200 g Butter, 200 g Zucker, 4 Eier und 150 g Mehl. Backe ihn 40 Minuten bei 180 Grad.",
    63: "Der Zug nach Zürich fährt um 07:42 Uhr ab Baar. Er kommt um 08:05 Uhr an. Die Fahrt dauert also 23 Minuten.",
    64: "Liebe Oma, wie geht es dir? Bei uns ist alles gut. Letzte Woche habe ich einen grossen Fisch gefangen! Viele Grüsse, dein Enkel",
    65: "Fragt der Lehrer: \"Was ist flüssiger als Wasser?\" Antwortet Max: \"Die Hausaufgaben! Die sind überflüssig.\"",
    66: "Das Spiel endet 3:2. In der 89. Minute schiesst unsere Mannschaft das Siegestor. Alle jubeln und springen in die Luft!",
    67: "Der Gepard rennt bis zu 110 km/h schnell. Ein Blauwal wird über 30 Meter lang. Kolibris schlagen 50-mal pro Sekunde mit den Flügeln.",
    68: "Die Schweiz hat 26 Kantone und vier Landessprachen: Deutsch, Französisch, Italienisch und Rätoromanisch. Die Bundesstadt ist Bern.",
    69: "Ich kaufe 2 Brote für je 3.50 Fr., 1 Liter Milch für 1.60 Fr. und 6 Eier für 4.20 Fr. Zusammen kostet das 12.80 Fr.",
    70: "Es war einmal ein kleiner Fisch, der wollte nicht auf jeden Tisch. Er schwamm davon, so schnell er kann, und fing ein neues Leben an.",
    71: "Wusstest du, dass ein Oktopus drei Herzen hat? Und dass manche Schnecken bis zu drei Jahre schlafen können? Die Natur ist voller Wunder!",
    72: "Vor 2000 Jahren lebten die Römer in Augusta Raurica. Sie bauten Strassen, Bäder und ein grosses Theater. Heute kann man es besuchen.",
    73: "3, 2, 1 - los! Die Autos rasen über die orange Bahn. Wer zuerst drei Runden schafft, gewinnt den goldenen Pokal.",
    74: "Am Montag wird es sonnig mit 24 Grad. Am Dienstag ziehen Wolken auf, und am Mittwoch regnet es. Nimm einen Schirm mit!",
    75: "Die Burg hatte dicke Mauern, einen tiefen Graben und eine Zugbrücke. Der Bergfried war der höchste Turm; er diente zur Verteidigung.",
    76: "Das Velo wurde vor über 200 Jahren erfunden. Die ersten Velos hatten noch keine Pedale. Man stiess sich mit den Füssen vom Boden ab.",
    77: "Zuerst schneide ich die Zwiebel in kleine Würfel. Dann brate ich sie in der Pfanne an. Zum Schluss gebe ich die Tomaten dazu.",
    78: "Mitten in der Nacht hörten wir ein Geräusch. Was war das? Wir nahmen die Taschenlampe und schauten nach: Es war nur ein Igel!",
    79: "Ein Baum kann über 1000 Jahre alt werden. Seine Wurzeln holen Wasser aus der Erde, und seine Blätter machen aus Licht und Luft Zucker.",
    80: "Herzliche Gratulation! Du hast alle 80 Lektionen geschafft. Jetzt kannst du mit zehn Fingern blind und schnell schreiben. Weiter so!"
  };

  /* ---------------- die 80 Lektionen ---------------- */
  // Buchstaben in der Reihenfolge, in der sie dazukommen: [Lektion, neue Tasten, Titel]
  const NEU = [
    [1, "fj", "f und j – die Tasten mit den Rillen"], [2, "dk", "d und k"], [3, "sl", "s und l"], [4, "aö", "a und ö"], [5, "gh", "g und h"],
    [6, "", "Wiederholung: Grundreihe"], [7, "ei", "e und i"], [8, "ru", "r und u"], [9, "tz", "t und z"], [10, "", "Wiederholung"],
    [11, "wo", "w und o"], [12, "qp", "q und p"], [13, "ü", "ü"], [14, "", "Wiederholung: obere Reihe"], [15, "vm", "v und m"],
    [16, "c,", "c und Komma"], [17, "x.", "x und Punkt"], [18, "y-", "y und Bindestrich"], [19, "bn", "b und n"], [20, "ä", "ä"], [21, "", "Wiederholung: alle Kleinbuchstaben"]
  ];
  const LESSONS = [];
  let keys = "";
  NEU.forEach(([n, neu, title]) => { keys += neu; LESSONS[n] = { n, title, keys, neu, kind: "drill" }; });
  LESSONS[22] = { n: 22, title: "Grossbuchstaben: linke Hand (Shift rechts)", kind: "caps", side: "left" };
  LESSONS[23] = { n: 23, title: "Grossbuchstaben: rechte Hand (Shift links)", kind: "caps", side: "right" };
  LESSONS[24] = { n: 24, title: "Nomen schreibt man gross", kind: "caps", side: "both" };
  for (let n = 25; n <= 30; n++) LESSONS[n] = { n, title: "Kurze Sätze", kind: "text" };
  LESSONS[31] = { n: 31, title: "Zahlen 1 bis 5", kind: "digits", digits: "12345", extra: "Ich habe 3 Katzen und 2 Hunde. Wir sind 5 Kinder." };
  LESSONS[32] = { n: 32, title: "Zahlen 6 bis 0", kind: "digits", digits: "67890", extra: "Unsere Klasse hat 24 Kinder. Der Zug kommt um 9 Uhr." };
  const ZEICHEN_TITEL = { 33: "Zahlen in Sätzen", 34: "Fragezeichen und Ausrufezeichen", 35: "Doppelpunkt und Strichpunkt", 36: "Anführungszeichen und Klammern",
    37: "Rechnen: + - = /", 38: "Prozent, & und *", 39: "Wiederholung: Zeichen", 40: "Datum und Uhrzeit" };
  for (let n = 33; n <= 40; n++) LESSONS[n] = { n, title: ZEICHEN_TITEL[n], kind: "text" };
  const THEMEN = ["Tiere", "Schule", "Kanton Zug", "Baar", "Essen", "Wetter", "Sport", "Fischen", "Familie", "Ferien", "Autos", "Weltall", "10-Finger-Schreiben",
    "Im Wald", "Musik", "Geburtstag", "Berge", "Haustiere", "Im Meer", "Roboter", "Wilhelm Tell", "Rezept", "Fahrplan", "Ein Brief", "Ein Witz", "Fussball", "Tier-Rekorde",
    "Die Schweiz", "Einkaufen", "Ein Gedicht", "Wusstest du?", "Die Römer", "Autorennen", "Wetterbericht", "Ritter", "Das Velo", "Kochen", "Abenteuer", "Bäume", "Geschafft!"];
  for (let n = 41; n <= 80; n++) LESSONS[n] = { n, title: (n <= 60 ? "Sätze: " : "Text: ") + THEMEN[n - 41], kind: "text" };
  const COUNT = 80;
  const target = n => Math.round(40 + n * 1.5); // Anschläge pro Minute für 3 Sterne

  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const fits = (w, set) => [...w].every(ch => set.includes(ch));

  // eine Übung für eine Lektion, etwa 3 Zeilen lang
  function makeText(L){
    if (L.kind === "text") return SAETZE[L.n];
    if (L.kind === "digits") {
      const groups = [];
      for (let k = 0; k < 10; k++) groups.push(Array.from({ length: 2 + (k % 3) }, () => rnd([...L.digits])).join(""));
      return groups.join(" ") + " " + L.extra;
    }
    if (L.kind === "caps") {
      const pick = L.side === "both" ? NOMEN : NOMEN.filter(w => RIGHT_HAND.has(w[0].toLowerCase()) === (L.side === "right"));
      const out = [];
      while (out.join(" ").length < 120) out.push(L.side === "both" && Math.random() < 0.3 ? rnd(["der", "die", "das", "ein", "eine", "und"]) : rnd(pick));
      return out.join(" ");
    }
    // Buchstaben-Übung: zuerst die neuen Tasten, dann Wörter und Silben
    const set = L.keys, neu = L.neu || set.slice(-4).replace(/[,.-]/g, "") || set;
    const words = WOERTER.filter(w => w.length > 1 && fits(w, set));
    const withNew = words.filter(w => [...neu].some(ch => w.includes(ch)));
    const letters = [...set].filter(ch => /[a-zäöü]/.test(ch));
    const out = [];
    [...neu].forEach(ch => { out.push(ch.repeat(3)); out.push(ch + rnd(letters) + ch); });
    while (out.join(" ").length < 130) {
      const r = Math.random();
      if (r < 0.45 && withNew.length) out.push(rnd(withNew));
      else if (r < 0.7 && words.length) out.push(rnd(words));
      else out.push(Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, k) => k === 1 && neu ? rnd([...neu]) : rnd(letters)).join(""));
      if (set.includes(",") && Math.random() < 0.1) out[out.length - 1] += ",";
      if (set.includes(".") && Math.random() < 0.08) out[out.length - 1] += ".";
      if (set.includes("-") && Math.random() < 0.06) out.push("-");
    }
    return out.join(" ");
  }

  /* ---------------- die App ---------------- */
  Hub.register({
    id: "typing", section: "learning", title: "Tipp-Meister", icon: "⌨️",
    blurb: "10-Finger-Schreiben auf der Schweizer Tastatur: 80 Lektionen, von der Grundreihe bis zu ganzen Texten.",
    stat: () => passed() ? `${passed()} von ${COUNT} Lektionen` : "",
    badges: [
      { id: "type1",    icon: "⌨️", name: "Erste Tasten",   desc: "Bestehe deine erste Lektion",       test: () => passed() >= 1 },
      { id: "type10",   icon: "🖐️", name: "Zehn Finger",    desc: "Bestehe 10 Lektionen",               test: () => passed() >= 10 },
      { id: "type40",   icon: "📜", name: "Vielschreiber",  desc: "Bestehe 40 Lektionen",               test: () => passed() >= 40 },
      { id: "type80",   icon: "👑", name: "Tipp-Meister",   desc: "Bestehe alle 80 Lektionen",          test: () => passed() >= COUNT },
      { id: "type100",  icon: "🚀", name: "100 Anschläge",  desc: "Schreibe 100 Anschläge pro Minute",  test: () => (T.topApm || 0) >= 100 },
      { id: "type150",  icon: "⚡", name: "150 Anschläge",  desc: "Schreibe 150 Anschläge pro Minute",  test: () => (T.topApm || 0) >= 150 },
      { id: "typeZero", icon: "💎", name: "Null Fehler",    desc: "Eine Lektion ganz ohne Fehler",       test: () => !!T.perfect },
      { id: "typeRobo", icon: "🏎️", name: "Robo geschlagen", desc: "Gewinne ein Rennen gegen Robo",      test: () => (T.roboWins || 0) >= 1 },
      { id: "typeCombo", icon: "🔥", name: "Feuer-Combo",   desc: "Tippe 50 Tasten am Stück richtig",    test: () => (T.topCombo || 0) >= 50 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <div class="wrap tp">
      <header>
        <a class="back-link" href="#/learning">← Learning</a>
        <div class="wordmark"><h1>Tipp-Meister</h1><span class="unit mono">/// 10-Finger-Schreiben</span></div>
        <p class="tagline">Schreib mit allen zehn Fingern, ohne auf die Tastatur zu schauen. Wähle eine Lektion und los geht's!</p>
      </header>
      <section class="tp-lessons" aria-label="Lektionen">
        <div class="tp-lessons-head"><h2>Lektionen</h2><span class="level-desc" id="tpProgress"></span></div>
        <div class="tp-grid" id="tpGrid"></div>
      </section>
      <section class="page tp-page">
        <div class="tp-head">
          <h2 id="tpTitle"></h2>
          <div class="tp-stats mono"><span id="tpTime">0:00</span><span id="tpApm">0 A/min</span><span id="tpErr">0 Fehler</span></div>
        </div>
        <canvas class="tp-race" id="tpRace" width="960" height="190" aria-hidden="true"></canvas>
        <div class="tp-text mono" id="tpText" tabindex="0" aria-label="Text zum Abschreiben"></div>
        <textarea class="tp-input" id="tpInput" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Hier tippen"></textarea>
        <div class="tp-hint" id="tpHint"></div>
        <div class="tp-kb" id="tpKb" aria-hidden="true"></div>
        <div class="tp-result" id="tpResult" hidden>
          <div class="tp-stars" id="tpStars"></div>
          <div class="tp-result-text" id="tpResultText"></div>
          <div class="tp-actions">
            <button class="btn" id="tpNext" type="button">Nächste Lektion →</button>
            <button class="btn ghost" id="tpAgain" type="button">↻ Nochmal</button>
          </div>
        </div>
        <div class="card-foot">
          <button class="btn ghost small" id="tpRestart" type="button">↻ Neu starten</button>
          <button class="btn ghost small" id="tpRaceBtn" type="button">🏎️ Rennen: an</button>
          <span class="level-desc">Tipp: Die Zeigefinger liegen auf f und j – dort spürst du kleine Rillen.</span>
        </div>
      </section>
    </div>`;
    const $ = id => document.getElementById(id);
    const textEl = $("tpText"), input = $("tpInput"), kb = $("tpKb"), hint = $("tpHint");
    let L = null, text = "", pos = 0, errors = 0, wrongAt = new Set(), startT = 0, timer = null, done = false, isOpen = false;
    let combo = 0;

    /* ----- die Bildschirm-Tastatur ----- */
    const keyEls = {};
    ROWS.forEach(row => {
      const r = document.createElement("div");
      r.className = "tp-row";
      row.forEach(([k, s, f, w, id]) => {
        const el = document.createElement("div");
        el.className = "tp-key f" + f + (k === "f" || k === "j" ? " bump" : "");
        el.style.flexGrow = w || 1;
        el.innerHTML = s && /[^a-zäöüA-Z]/.test(s) && s.toLowerCase() !== k ? `<small></small><span></span>` : `<span></span>`;
        el.querySelector("span").textContent = k === " " ? "" : k;
        if (el.querySelector("small")) el.querySelector("small").textContent = s;
        keyEls[id || k] = el;
        r.appendChild(el);
      });
      kb.appendChild(r);
    });

    // die Taste sinkt kurz ein (grün), oder blinkt rot bei einem Fehler
    function press(info, kind){
      if (!info) return;
      const els = [keyEls[info.key === " " ? "space" : info.key]];
      if (info.shift) els.push(keyEls[info.finger <= 3 ? "shiftR" : "shiftL"]);
      els.forEach(el => {
        if (!el) return;
        el.classList.remove("hit", "miss"); void el.offsetWidth; el.classList.add(kind);
        clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove(kind), kind === "miss" ? 380 : 160);
      });
    }

    /* ----- das Rennen: eine Strasse in 3D durch die Berge, du gegen Robo ----- */
    const race = (() => {
      const cv = $("tpRace"), ctx = cv.getContext("2d"), W = 960, H = 190, HOR = 70;
      const fx = Fun.pops();
      let shown = 0, robo = 0, roll = 0, speed = 0, last = 0, wobble = 0, ahead = null, fire = 0, raf = 0;
      const on = () => T.race !== false;
      // where a spot on the road ends up on the screen: z = 1 is right in front of you, bigger is further away
      const at = (lane, z) => { const k = 1 / z; return { x: W / 2 + lane * W * 0.42 * k, y: HOR + (H - HOR) * k, s: k }; };
      const roboPos = () => {
        if (!startT || !L) return 0;
        const secs = (performance.now() - startT) / 1000;
        return Math.min(text.length, secs * target(L.n) / 60);
      };
      function car(x, y, s, body, top, label, flames){
        const w = 120 * s, h = 34 * s;
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, y + 2 * s, w * 0.55, 8 * s, 0, 0, 7); ctx.fill();
        if (flames) {
          for (let i = 0; i < 3; i++) {
            const fl = 18 + Math.random() * 22 * flames;
            ctx.fillStyle = ["#ffe14d", "#ff9f1a", "#ff4d1a"][i];
            ctx.beginPath(); ctx.moveTo(x - w * 0.3 + i * w * 0.3 - 8 * s, y - h * 0.3); ctx.lineTo(x - w * 0.3 + i * w * 0.3, y - h * 0.3 + fl * s); ctx.lineTo(x - w * 0.3 + i * w * 0.3 + 8 * s, y - h * 0.3); ctx.fill();
          }
        }
        ctx.fillStyle = "#1b1b1b";
        [[-0.38, 0], [0.38, 0]].forEach(([dx]) => { ctx.fillRect(x + dx * w - 11 * s, y - 14 * s, 22 * s, 16 * s); });
        ctx.fillStyle = body; round(x - w / 2, y - h - 6 * s, w, h, 10 * s); ctx.fill();
        ctx.fillStyle = top; round(x - w * 0.3, y - h - 26 * s, w * 0.6, 24 * s, 8 * s); ctx.fill();
        ctx.fillStyle = "rgba(170,220,255,0.9)"; round(x - w * 0.24, y - h - 22 * s, w * 0.48, 15 * s, 5 * s); ctx.fill();
        ctx.fillStyle = "#ff3b3b"; ctx.fillRect(x - w / 2 + 6 * s, y - h + 6 * s, 14 * s, 6 * s); ctx.fillRect(x + w / 2 - 20 * s, y - h + 6 * s, 14 * s, 6 * s);
        if (label) { ctx.font = `bold ${Math.max(11, 16 * s)}px system-ui`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3; ctx.strokeText(label, x, y - h - 34 * s); ctx.fillText(label, x, y - h - 34 * s); }
      }
      function round(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
      function draw(now){
        raf = 0;
        if (!isOpen || !on()) return;
        const dt = Fun.dt(now, last, 0.05); last = now;
        shown += (pos - shown) * Math.min(1, dt * 10);
        robo = done ? robo : roboPos();
        speed += ((startT && !done ? stats().apm : 0) / 60 - speed) * Math.min(1, dt * 2);
        roll += speed * dt * 0.35; wobble = Math.max(0, wobble - dt * 2); fire = combo >= 10 ? Math.min(1, (combo - 5) / 30) : 0;
        // the sky, the Alps and the lake
        const sky = ctx.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, "#4f9be8"); sky.addColorStop(1, "#cfe6ff");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HOR);
        const peaks = [[60, 38], [170, 22], [290, 44], [410, 16], [540, 36], [660, 20], [790, 40], [900, 26]];
        peaks.forEach(([px, py]) => {
          const x = ((px - roll * 4) % (W + 200) + W + 200) % (W + 200) - 100;
          ctx.fillStyle = "#7c8ba3"; ctx.beginPath(); ctx.moveTo(x - 90, HOR); ctx.lineTo(x, py); ctx.lineTo(x + 90, HOR); ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(x - 22, py + 16); ctx.lineTo(x, py); ctx.lineTo(x + 22, py + 16); ctx.fill();
        });
        ctx.fillStyle = "#6cc04a"; ctx.fillRect(0, HOR, W, H - HOR);
        // the road, with stripes rushing past
        const near = at(-1.15, 1), far = at(-1.15, 40), near2 = at(1.15, 1), far2 = at(1.15, 40);
        ctx.fillStyle = "#555b66"; ctx.beginPath(); ctx.moveTo(near.x, H); ctx.lineTo(far.x, far.y); ctx.lineTo(far2.x, far2.y); ctx.lineTo(near2.x, H); ctx.fill();
        for (let k = 0; k < 40; k++) {
          const z0 = 1 + k * 0.9 - (roll % 1.8), z1 = z0 + 0.45;
          if (z0 < 0.95) continue;
          const a = at(0, z0), b = at(0, z1);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 6 * a.s; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          // red and white kerbs, and trees on the side
          [-1.2, 1.2].forEach(l => { const c = at(l, z0), d = at(l, z1); ctx.strokeStyle = k % 2 ? "#ff4d4d" : "#fff"; ctx.lineWidth = 10 * c.s; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); });
        }
        for (let k = 0; k < 14; k++) {
          const z = 1.2 + k * 2.6 - (roll * 1.4 % 2.6);
          [-1.9, 1.9].forEach((l, j) => {
            const t = at(l + (k % 2 ? 0.3 : 0) * (j ? 1 : -1), z);
            if (t.y < HOR + 2) return;
            ctx.fillStyle = "#2f7d32"; ctx.beginPath(); ctx.moveTo(t.x - 26 * t.s, t.y); ctx.lineTo(t.x, t.y - 70 * t.s); ctx.lineTo(t.x + 26 * t.s, t.y); ctx.fill();
          });
        }
        // the finish line, once it's close
        const zf = 1 + (text.length - shown) * 0.12;
        if (zf < 40 && text.length) {
          const a = at(-1.15, zf), b = at(1.15, zf), n = 12;
          for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? "#111" : "#fff"; ctx.fillRect(a.x + (b.x - a.x) * i / n, a.y - 6 * a.s, (b.x - a.x) / n + 1, 10 * a.s); }
        }
        // Robo, and you
        const gap = robo - shown, rz = Math.max(0.9, 1.35 + gap * 0.12), r = at(-0.5, rz);
        const me = at(0.5, 1.35), sway = Math.sin(now / 40) * wobble * 14;
        const cars = [{ z: rz, f: () => car(r.x, r.y, r.s, "#d62b2b", "#a81f1f", rz < 6 ? (gap < 0 ? "🤖 Robo (hinter dir)" : "🤖 Robo") : "", 0) },
                      { z: 1.35, f: () => car(me.x + sway, me.y, me.s, "#1f6bff", "#1650c8", "", fire) }];
        cars.sort((a, b) => b.z - a.z).forEach(c => c.f());
        if (rz >= 6 && gap > 0) { ctx.font = "bold 13px system-ui"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(`🤖 Robo ist ${Math.round(gap)} Zeichen vor dir`, W / 2, HOR + 14); }
        // passing and being passed
        if (startT && !done) {
          const now2 = gap < 0;
          if (ahead !== null && now2 !== ahead) {
            fx.pop(now2 ? "ÜBERHOLT! 😎" : "Robo überholt! 🤖", W / 2, 60, now2 ? "#ffe14d" : "#ff8a8a", 30);
            if (now2) Fun.sfx.whoosh(); else Fun.sfx.honk();
          }
          ahead = now2;
        }
        // the speedo and the combo
        ctx.fillStyle = "rgba(10,20,45,0.6)"; round(10, 10, 150, 30, 8); ctx.fill();
        ctx.font = "bold 15px system-ui"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(`🏎️ ${startT ? stats().apm : 0} A/min`, 20, 25);
        if (combo >= 5) {
          ctx.fillStyle = combo >= 10 ? "rgba(255,120,30,0.9)" : "rgba(10,20,45,0.6)"; round(W - 170, 10, 160, 30, 8); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.fillText(`${combo >= 10 ? "🔥" : "✨"} Combo ${combo}`, W - 20, 25);
        }
        ctx.textBaseline = "alphabetic";
        fx.draw(ctx, dt);
        raf = requestAnimationFrame(draw);
      }
      return {
        start(){ cv.hidden = !on(); if (!raf && on()) { last = performance.now(); raf = requestAnimationFrame(draw); } },
        stop(){ if (raf) cancelAnimationFrame(raf); raf = 0; },
        reset(){ shown = 0; robo = 0; ahead = null; fx.clear(); },
        good(c){
          if (c && c % 10 === 0) { fx.pop(c >= 50 ? `MEGA COMBO ${c}! 🔥🔥` : `COMBO ${c}! 🔥`, W * 0.72, 70, "#ffb347", 26 + Math.min(16, c / 5)); Fun.sfx.ding(); }
          if (c > (T.topCombo || 0)) T.topCombo = c;
        },
        oops(){ wobble = 1; if (combo === 0) fx.pop(["Oops!", "Hoppla!", "Huch!"][Math.floor(Math.random() * 3)], W * 0.62, 90, "#ff8a8a", 22); Fun.sfx.nope(); },
        finish(ok){
          const won = ok && pos >= robo - 0.5;
          if (won) { T.roboWins = (T.roboWins || 0) + 1; fx.pop("🏆 Du hast Robo geschlagen!", W / 2, 70, "#ffe14d", 32); fx.burst(W / 2, 70, "#ffe14d", 40, 260); Fun.sfx.tada(); }
          else if (ok) { fx.pop("Robo war schneller 🤖 Nochmal?", W / 2, 70, "#ffffff", 26); Fun.sfx.ding(); }
          else Fun.sfx.wah();
        },
        toggle(){ T.race = !on(); Hub.saveStore(); $("tpRaceBtn").textContent = `🏎️ Rennen: ${on() ? "an" : "aus"}`; cv.hidden = !on(); if (on()) this.start(); else this.stop(); }
      };
    })();

    function renderGrid(){
      const grid = $("tpGrid");
      grid.innerHTML = "";
      for (let n = 1; n <= COUNT; n++) {
        const b = document.createElement("button");
        b.type = "button";
        const best = T.best[n];
        b.className = "tp-num" + (best ? " done" : "") + (L && L.n === n ? " on" : "");
        b.innerHTML = `<span>${n}</span><small>${best ? "★".repeat(best.stars) + "☆".repeat(3 - best.stars) : ""}</small>`;
        b.title = LESSONS[n].title;
        b.addEventListener("click", () => { start(n); textEl.scrollIntoView({ block: "center", behavior: "smooth" }); });
        grid.appendChild(b);
      }
      $("tpProgress").textContent = `${passed()} von ${COUNT} bestanden`;
    }

    function start(n){
      L = LESSONS[Math.max(1, Math.min(COUNT, n))];
      T.lesson = L.n; Hub.saveStore();
      text = makeText(L);
      pos = 0; errors = 0; wrongAt = new Set(); startT = 0; done = false; combo = 0;
      race.reset();
      clearInterval(timer); timer = null;
      $("tpTitle").textContent = `Lektion ${L.n}: ${L.title}`;
      $("tpResult").hidden = true;
      textEl.innerHTML = "";
      [...text].forEach(ch => {
        const sp = document.createElement("span");
        sp.textContent = ch;
        if (ch === " ") sp.className = "sp";
        textEl.appendChild(sp);
      });
      renderGrid();
      update();
      focus();
    }

    function focus(){ if (isOpen) input.focus({ preventScroll: true }); }

    function stats(){
      const secs = startT ? (performance.now() - startT) / 1000 : 0;
      const apm = secs > 1 ? Math.round(pos / secs * 60) : 0;
      return { secs, apm, errPct: pos ? errors / Math.max(pos, 1) * 100 : 0 };
    }

    function update(){
      const spans = textEl.children;
      for (let k = 0; k < spans.length; k++) {
        const c = spans[k].className.includes("sp") ? "sp" : "";
        spans[k].className = [c, k < pos ? (wrongAt.has(k) ? "bad" : "ok") : k === pos ? "cur" : ""].filter(Boolean).join(" ");
      }
      if (spans[pos]) {
        const box = textEl.getBoundingClientRect(), r = spans[pos].getBoundingClientRect();
        if (r.bottom > box.bottom - 8 || r.top < box.top) textEl.scrollTop += r.top - box.top - 40;
      }
      // die nächste Taste leuchtet, und bei Grossbuchstaben die Shift-Taste der anderen Hand
      Object.values(keyEls).forEach(el => el.classList.remove("next"));
      const ch = text[pos];
      const info = ch === undefined ? null : CHAR[ch];
      if (info) {
        keyEls[info.key === " " ? "space" : info.key].classList.add("next");
        if (info.shift) keyEls[info.finger <= 3 ? "shiftR" : "shiftL"].classList.add("next");
        const name = ch === " " ? "Leertaste" : `«${ch}»`;
        hint.innerHTML = `Nächste Taste: <b>${name}</b> – <span class="f${info.finger}-text">${FINGERS[info.finger]}</span>` +
          (info.shift ? ` + Shift mit dem ${info.finger <= 3 ? "rechten" : "linken"} kleinen Finger` : "");
      } else hint.textContent = done ? "" : "";
      const s = stats();
      $("tpTime").textContent = Hub.formatTime(Math.floor(s.secs));
      $("tpApm").textContent = `${s.apm} A/min`;
      $("tpErr").textContent = `${errors} Fehler`;
    }

    // stimmt das getippte Zeichen? (gebogene Anführungszeichen zählen auch)
    const same = (typed, want) => typed === want || (want === "\"" && /[„“”«»]/.test(typed)) || (want === "'" && /[’‘]/.test(typed));

    function typeChar(ch){
      if (done || !L) return;
      if (!startT) { startT = performance.now(); timer = setInterval(update, 500); }
      const want = text[pos];
      if (same(ch, want)) {
        press(CHAR[want], "hit");
        pos++; combo++;
        race.good(combo);
        if (pos >= text.length) finish();
      } else {
        press(CHAR[ch] || CHAR[want], "miss");
        errors++; combo = 0;
        wrongAt.add(pos);
        race.oops();
        textEl.classList.remove("shake"); void textEl.offsetWidth; textEl.classList.add("shake");
      }
      update();
    }

    function finish(){
      done = true;
      clearInterval(timer); timer = null;
      const s = stats(), goal = target(L.n);
      const ok = s.errPct <= 5;
      const stars = !ok ? 0 : s.errPct <= 1.5 && s.apm >= goal ? 3 : s.errPct <= 3 && s.apm >= goal * 0.75 ? 2 : 1;
      if (ok) {
        const old = T.best[L.n];
        if (!old || stars > old.stars || (stars === old.stars && s.apm > old.apm)) T.best[L.n] = { stars, apm: s.apm, err: Math.round(s.errPct * 10) / 10 };
        T.topApm = Math.max(T.topApm || 0, s.apm);
        if (errors === 0) T.perfect = true;
      }
      race.finish(ok);
      // a lesson finished today, for the Grown-ups page
      { const t = new Date(), key = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
        T.log = T.log || {}; const day = T.log[key] = T.log[key] || { a: 0, c: 0 }; day.a++; if (ok) day.c++; }
      Hub.saveStore();
      Hub.checkBadges();
      $("tpStars").textContent = ok ? "★".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆";
      $("tpResultText").innerHTML = (ok ? `<b>Bestanden!</b> ` : `<b>Noch nicht bestanden</b> – höchstens 5 % Fehler. `) +
        `${s.apm} Anschläge pro Minute · ${errors} Fehler (${s.errPct.toFixed(1)} %) · Zeit ${Hub.formatTime(Math.round(s.secs))}` +
        `<br>Für 3 Sterne: ${goal} Anschläge pro Minute und höchstens 1.5 % Fehler.`;
      $("tpNext").hidden = L.n >= COUNT;
      $("tpResult").hidden = false;
      if (ok) Hub.confettiBurst($("tpStars"));
      renderGrid();
      hint.textContent = "";
      Object.values(keyEls).forEach(el => el.classList.remove("next"));
      ($("tpNext").hidden ? $("tpAgain") : ok ? $("tpNext") : $("tpAgain")).focus();
    }

    // Tastatur: alles läuft über ein unsichtbares Textfeld, so klappen auch Handys und spezielle Tasten
    input.addEventListener("input", () => {
      const v = input.value;
      input.value = "";
      [...v].forEach(typeChar);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && done) { e.preventDefault(); start(L.n < COUNT && T.best[L.n] ? L.n + 1 : L.n); }
      if (e.key === "Backspace") e.preventDefault(); // zurück gibt es nicht – wie bei Typewriter
    });
    [textEl, kb, hint].forEach(el => el.addEventListener("click", focus));
    $("tpRestart").addEventListener("click", () => start(L.n));
    $("tpRaceBtn").addEventListener("click", () => { race.toggle(); focus(); });
    $("tpRaceBtn").textContent = `🏎️ Rennen: ${T.race !== false ? "an" : "aus"}`;
    Fun.soundButton($("tpRestart"));
    $("tpAgain").addEventListener("click", () => start(L.n));
    $("tpNext").addEventListener("click", () => start(L.n + 1));

    start(T.lesson);

    return {
      open(){ isOpen = true; renderGrid(); focus(); race.start(); },
      close(){ isOpen = false; race.stop(); clearInterval(timer); timer = null; if (!done && startT) start(L.n); }
    };
  }

})();
