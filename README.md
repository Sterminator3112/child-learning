# 🎒 Learn & Play

Learning and games for a 5th grader in Zug. The home screen asks **Learning** or **Games**, and each section lists its apps and has its own 🏆 trophy shelf.

▶️ **Play it here: https://nicolanardino.github.io/child-learning/**

There's nothing to install and no build step. Just open `index.html` in a browser.

- 🤖 **New here?** Robo gives a guided tour of the home screen, then a show reel of every app (*🎬 Meet the apps* on the home screen).
- 📅 **Every day** there are three new challenges. They earn 🪙 coins for the 🛍️ **Shop**, and playing every day keeps your 🔥 streak going.
- 👨‍👩‍👦 **Players:** everyone in the family gets their own progress, coins and trophies.
- ⭐ **Study stars:** every 10 right answers in Learning (and every typing lesson) earn a star. Stars swap for shop coins and unlock Race Off's 🧠 Brainiac car and 🌌 Galaxy paint, and 10 right answers in a day turn on a 📚 study boost (x1.5 coins in Race Off).
- 👪 **Grown-ups page:** a weekly summary for every player (practice, accuracy against last week, learning and game time, topics to work on, ready to copy), a progress report, the players, the 💬 play-test notes from inside the games, and a backup code to move everything to another device.
- ♿ **Comfort:** *Less motion* and *Bigger buttons* on the Grown-ups page (the system's reduced-motion setting is followed too).
- 📱 **Phones and tablets:** *Add to Home Screen* installs it like an app, and it works offline. Every game has touch controls. *⚙️ Graphics* at the bottom of the home screen can be set to Low for older phones.

## 📚 Learning

Every subject has three levels (Warm-up, Practice, Challenge), a worked answer for every question, a ⏱️ Time Trial, a 🏁 race against Robo, and a fun scene above the questions.

- 🔢 **Fast Math**: six maths topics from the 5th-grade workbook, with a 🚀 Rocket Run through space.
- 🧙 **Word Wizard**: school English like *Young World 3*, with a 🧙 Wizard Duel against word monsters.
- 🥨 **Deutsch Dash**: Deutsch wie in den *Sprachstarken 5* (Schweizer Rechtschreibung), mit der Fehlerteufel-Jagd.
- 🥐 **Français Fusée**: das erste Jahr Französisch, mit 🔊 zum Nachsprechen und einer 🚴 Tour de France.
- 🌍 **NMG Entdecker**: Kantone, Geografie, Geschichte, Körper, Tiere und Technik, mit einer Ballonfahrt.
- 🎵 **Musik Maestro**: Noten lesen, Takt, Instrumente und ein Hör-Quiz, auf einer 3D-Bühne.
- ⌨️ **Tipp-Meister**: 10-Finger-Schreiben auf der Schweizer Tastatur, 80 Lektionen.
- ⚛️ **Quantum Lab**: quantum physics for 11-year-olds, with five cartoon labs and a 3D atom to build.

## 🎮 Games

**🏁 Racing** (with nitro warp speed, 3D titles and finish-line fireworks)
- 🚙 **Race Off**: physics hill-climb racing with flips, fuel, 30 levels and a garage to upgrade your cars.
- 🏎️ **Stunt Wheels**: side-on stunt racing on orange toy track, with loops, jumps and nitro.
- 🏎️ **Turbo Track**: race three robot cars round floating toy tracks, from the driver's seat or above.

**⚽ Sports**
- ⚽ **Blox Soccer**, 🏀 **Blox Hoops**, 🎱 **Blox Pool**, 🎳 **Blox Bowling** and 🏓 **Ping Pong 3D**, with blocky Roblox-style players and robot opponents.

**🗺️ Adventure**
- 🌲 **99 Nights**: keep the campfire burning and survive 99 nights in a 3D forest.
- 🧗 **Parkour Run**: a 3D obby high in the sky.
- 🏃 **Robot Tag** and 🏁 **Tag Rush**: run away from the taggers.
- 🧟 **Zombie Blaster**: blast silly zombies in a moonlit graveyard.
- 🥚 **Egg Heist**: like Steal An Egg on Roblox. Buy eggs, earn cash and steal the best ones.
- 🐾 **Critter Quest**: like Pokémon. Catch critters in the tall grass, level them up until they evolve, and beat the Gym Captain for the ⚡ Spark Badge.

**👾 Arcade**
- 👻 **Pac-Man** and 🟡 **Pac-Man 3D** (from inside the maze).
- 🐍 **Rainbow Snake**: a rainbow tail, a ⭐ for Rainbow Mode, and a ♾️ Can't-Die Mode with 3 upgrades on the lawn.
- 🧱 **Block Drop 3D**: Tetris-style with 3D cubes, three modes (Marathon, Sprint, Dig), T-Spins and combos.
- 🚀 **Rocket Lander**: land softly on 8 worlds, each with its real gravity.
- 🏓 **Rainbow Bricks**: smash rainbow brick walls, with power-ups.
- 🐸 **Frog Hop**: cross a road of race cars and a river of logs.
- 🏗️ **Endless Tower** and 🎣 **Fishing Beach** (500 fish to catch).

**🧱 Build & grow**
- ⛏️ **Block World**: a Minecraft-style sandbox, in Creative or Survival.
- 🌱 **Garden Grow**: like Grow a Garden on Roblox.
- 🔥 **Storm Fire**: feed a campfire with twigs, logs, coal and dragon breath so it survives 10 storms (the last needs a level 100 fire). It evolves up to a Phoenix Fire and a 🌈 Rainbow Fire.

**🧠 Brain games**
- ♟️ **Blox Chess**: against BloxBot or a friend.
- 🃏 **Memory Match**: find the pairs, alone or with 2 players.

## How it's built

```
index.html                 the launcher, and the list of every app's stylesheet and script
manifest.webmanifest, sw.js, icons/   install on a phone and play offline
core/                      shared by everything: players and progress, trophies, screen switching (core.js),
                           the shared look (core.css), sounds and effects (fun.js), daily challenges, shop,
                           play-test notes, study stars (study.js), the Grown-ups page, and Robo's tour (tour.js)
learning/                  one folder per subject; notebook.js is the practice page they all share
games/                     one folder per game; game-frame.css is the full-screen frame, blocky.js the
                           Roblox-style 3D look, race-fx.js the race WOW kit
tests/                     the browser tests
```

The address bar keeps track of where you are (`#/games/pacman`), so the back button works and you can bookmark a game. Progress is saved in this browser's `localStorage`.

### Tests

Every pull request runs `.github/workflows/smoke.yml`: every script must parse, `tests/smoke.mjs` opens and plays every app on a desktop and a phone-sized screen, `tests/features.mjs` checks players, notes, backups, study stars and the weekly summary, `tests/raceoff.mjs` checks Race Off's physics, and `tests/a11y.mjs` runs axe-core on every page and app and checks the keyboard and the comfort settings.

### Adding a new app

1. Make a folder, like `games/snake/`, with a `.js` file (and a `.css` file if it needs one).
2. In the `.js` file, register the app:

   ```js
   Hub.register({
     id: "snake", section: "games",              // "learning" or "games"
     title: "Rainbow Snake", icon: "🐍",
     blurb: "One line about the app, for its card.",
     stat: () => "",                              // optional: shown on its card
     badges: [],                                  // optional: trophies for the section's shelf
     mount(host){ /* build it inside host */ return { open(){}, close(){} }; }
   });
   ```

3. Add its `<link>` and `<script>` lines to `index.html`. To put a game in a group on the Games page, add its id to `CATEGORIES` in `core/core.js`.

A new Learning subject only brings its topics and calls `Notebook.register({...})` (see the top of `learning/notebook.js`).
