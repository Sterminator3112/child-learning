// ESLint setup for Learn & Play. There is no build step: the app's files are classic browser
// scripts (not modules) that share objects through window, and the tests are Node ES modules.
// Run it with:  npm install --no-save --no-package-lock eslint@9.39.1 @eslint/js@9.39.1 globals@16.5.0 && npx eslint .
import js from "@eslint/js";
import globals from "globals";

// The objects each script puts on window for the others to use (window.Hub = ..., and so on).
const shared = Object.fromEntries([
  "BlockWorld", "Blocky", "ChessEngine", "Daily", "DeutschDash", "Feedback", "FishingFish",
  "FishingScene", "Fun", "Hub", "Levenshtein", "MathRocket", "MusikBuehne", "NmgExplorer",
  "Notebook", "QuantumAtom", "RaceFX", "RaceOffCar", "Study", "Tour", "TourDeFrance",
  "TurboTrackCourse", "TurboTrackSky", "WheelsMusic", "WizardDuel",
].map(name => [name, "readonly"]));

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  {
    rules: {
      // "try { ... } catch (e) {}" is used on purpose wherever saving or audio may fail quietly
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrors: "none", args: "none" }],
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser, ...shared },
    },
  },
  {
    files: ["sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // page.evaluate() callbacks run in the browser, so they see the app's shared objects too
      globals: { ...globals.node, ...globals.browser, ...shared, axe: "readonly", __ro: "readonly" },
    },
  },
];
