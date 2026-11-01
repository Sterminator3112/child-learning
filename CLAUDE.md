# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Learn & Play: a learning-and-games web app for a 5th grader in Zug, Switzerland (Learning subjects follow the Swiss curriculum; Deutsch uses Swiss spelling, no ß). Plain HTML/CSS/JavaScript with **no build step, no framework and no package.json**. Open `index.html` in a browser or serve the folder statically. It is deployed to GitHub Pages from `main` and installs as an offline PWA.

## Commands

```bash
# what CI runs first: every script must parse
for f in $(git ls-files '*.js' '*.mjs'); do node --check "$f" || exit 1; done

# browser tests need Playwright + Chromium (CI pins these versions)
npm install --no-save --no-package-lock playwright@1.47.2 axe-core@4.10.2
npx playwright install chromium

node tests/smoke.mjs            # open every subject and game, press Play, mash keys; fail on page errors
node tests/smoke.mjs desktop    # just the desktop pass (CI runs desktop and phone as separate jobs)
node tests/smoke.mjs phone      # just the phone pass: no sideways overflow, canvases fit the screen
node tests/features.mjs         # players/profiles, play-test notes, backup code
node tests/raceoff.mjs          # Race Off physics autopilot (car mustn't get stuck or sink)
node tests/a11y.mjs             # axe-core on every page, keyboard reachability, comfort settings
```

`tests/serve.mjs` is the shared static server and browser launcher. `PLAYWRIGHT_MODULE` overrides where Playwright is imported from, and `AXE_PATH` overrides the axe-core file. There is no linter.

## Architecture

**One page, everything loaded up front.** `index.html` holds the launcher markup plus a `<link>` and `<script>` for every app, in dependency order: `core/*` first, then `learning/notebook.js` before the subjects, then games (shared game helpers such as `games/blocky.js` and `games/race-fx.js` before the games that use them). `sw.js` precaches by scanning `index.html` for `src`/`href` paths, so **a file not referenced from `index.html` won't work offline**.

**Apps register themselves with `Hub` (`core/core.js`).** Each app is an IIFE that calls `Hub.register({ id, section: "learning"|"games", title, icon, blurb, stat(), badges, mount })`. `mount(host)` builds the app's DOM the first time it's opened and returns `{ open(), close() }`. Routing is hash-based (`#/`, `#/games`, `#/games/<id>`), and `Hub.leave()` goes back to the section. `Hub.page(id, ...)` adds non-app pages (Grown-ups, Shop). Games are grouped on the Games page by `CATEGORIES` in `core/core.js`; an id not listed there lands in "More games". The home screen, Robo's tour (`core/tour.js`), daily challenges and the Grown-ups page all build from `Hub.appList()`, so a registered app shows up everywhere automatically.

**Learning subjects go through `Notebook.register` (`learning/notebook.js`)**, not `Hub.register` directly. A subject supplies topics whose `generate(level, mode)` returns questions; the notebook supplies the levels, worked answers, Time Trial, race against Robo and trophies. The header comment in `notebook.js` documents the full contract.

**Progress is one object per player in `localStorage`.** `Hub.store` is the active player's object, shared by every app; each app keeps its own sub-object (for example `store.memory` or `store.critters`). Call `Hub.saveStore()` after changes and `Hub.checkBadges()` after anything a trophy test reads. The first player's key is `numberline:v1` (kept for old saves), other players use `numberline:v1:<id>`, and the player list is in `lp:profiles`. Switching player reloads the page. ⭐ Study stars (`core/study.js`) aren't stored: they're computed from the subjects' saved right answers, and only `store.starsSpent` is saved. Games spend them with `Study.spend(n)`.

**Games share a frame and a fun kit.** `games/game-frame.css` defines `.game-screen` (full-screen overlay), `.game-hud`, `.game-stage`, `.game-panel` (start/end panel) and `.game-touch`. `core/fun.js` exposes `Fun`: `Fun.screen(el, on)` to show or hide a game screen, `Fun.sfx.<name>()` sounds, `Fun.soundButton`, joystick and touch helpers, and the Low/High graphics quality setting. `Hub.confettiBurst` and `Hub.toast` are in core. A simple DOM game to copy from is `games/memory/memory.js`.

**The smoke test discovers apps on its own** and taps the first `.btn` in a visible `.game-panel`. A game's start panel should therefore have its main action as a `.btn`, and the game must not throw when that button is pressed, on desktop or on a phone-sized screen.

## Adding an app

1. Create `games/<id>/<id>.js` and `<id>.css` (or `learning/<subject>/...`).
2. Add both to `index.html` in the right place in the load order.
3. For a game, add its id to a group in `CATEGORIES` in `core/core.js`.
4. Add it to the README's list.

## Conventions

- Every file starts with a plain-language comment saying what it is and how it plays, written so a non-programmer could follow it. Comments throughout use the same simple, friendly voice and British spelling. Match it.
- Scripts are IIFEs with `"use strict"` and talk to each other only through globals (`Hub`, `Fun`, `Notebook`, `Study`).
- Inside an app, element IDs and CSS classes use a short app prefix (`mm…` for Memory Match, `cr…` for Critter Quest) because every app lives in the same document.
- Every game needs keyboard and touch controls, must fit a phone screen, and should follow the comfort settings (`Hub.lessMotion()`, bigger buttons).
- Games "like" commercial titles (Roblox games, Pokémon, Tetris) use original names and art, never the real characters or assets.
- Work happens on branches with PRs into `main`, merged with merge commits. CI (`.github/workflows/smoke.yml`) runs on every PR.
