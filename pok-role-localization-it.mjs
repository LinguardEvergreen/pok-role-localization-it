/**
 * Poké Role System - Italian Localization bootstrap.
 *
 * Registers the Babele translation directory for this module so that the
 * Italian-language Babele pack JSONs under compendium/it override the
 * English names/descriptions in the pok-role-system compendia.
 *
 * The original English names are preserved as compendium entry identifiers,
 * so any cross-reference on Pokémon actor sheets (moves, abilities, held
 * items, etc.) keeps working while the UI shows the Italian translation.
 */

const MODULE_ID = "pok-role-localization-it";
const TARGET_LANG = "it";
const LANG_DIR = "compendium/it";

/**
 * Perform the Babele registration using whichever API is available.
 * Babele 2.5.5+ exposes `game.babele`; older builds expose `Babele.get()`.
 */
function registerWithBabele() {
  const payload = { module: MODULE_ID, lang: TARGET_LANG, dir: LANG_DIR };

  if (game?.babele?.register) {
    game.babele.register(payload);
    return "game.babele";
  }

  if (typeof Babele !== "undefined" && typeof Babele.get === "function") {
    Babele.get().register(payload);
    return "Babele.get()";
  }

  return null;
}

/**
 * Register as early as possible. Babele's own `init` hook creates
 * `game.babele`, and we declare Babele as a required dependency in
 * module.json so that its init hook is guaranteed to run before ours.
 *
 * We also listen to `babele.init` as a safety net for environments where
 * hook ordering is reversed.
 */
Hooks.once("init", () => {
  const via = registerWithBabele();
  if (via) {
    console.log(`[${MODULE_ID}] Italian Babele pack registered via ${via}.`);
  } else {
    console.warn(
      `[${MODULE_ID}] Babele not detected at init. ` +
        `Install and enable "Babele" to apply Italian compendium translations.`
    );
  }
});

Hooks.once("babele.init", () => {
  // Called right after Babele finishes its own init. If our "init" hook ran
  // before Babele's (unexpected when Babele is declared as a dependency),
  // this call ensures we end up in `game.babele.modules`.
  const via = registerWithBabele();
  if (via) {
    console.log(`[${MODULE_ID}] Italian Babele pack re-registered via ${via} on babele.init.`);
  }
});

/**
 * Sanity checks at ready-time: warn the user if Babele isn't active, or if
 * the core language is something other than Italian (Babele filters
 * translation modules by matching `module.lang` with the core language
 * setting, so Italian packs only apply when the UI is set to Italian).
 */
Hooks.once("ready", () => {
  const babeleActive = !!game.modules.get("babele")?.active;

  if (!babeleActive) {
    ui.notifications?.warn(
      `Poké Role - Italiano: il modulo Babele non risulta attivo. ` +
        `Installa e abilita "Babele" per vedere le traduzioni italiane dei compendi.`,
      { permanent: true }
    );
    console.warn(`[${MODULE_ID}] Babele module is not active.`);
    return;
  }

  const coreLang = game.settings.get("core", "language");
  if (coreLang !== TARGET_LANG) {
    ui.notifications?.warn(
      `Poké Role - Italiano: la lingua di Foundry è impostata su "${coreLang}". ` +
        `Babele applica le traduzioni italiane solo quando la lingua del client è "Italiano". ` +
        `Vai su Impostazioni → Configura Impostazioni → Impostazioni del Core → Lingua e seleziona "Italiano", poi ricarica il mondo.`,
      { permanent: true }
    );
    console.warn(
      `[${MODULE_ID}] Core language is "${coreLang}"; Italian translations ` +
        `will not be applied until it is set to "it".`
    );
    return;
  }

  console.log(`[${MODULE_ID}] Ready. Babele active, language set to Italian.`);
});
