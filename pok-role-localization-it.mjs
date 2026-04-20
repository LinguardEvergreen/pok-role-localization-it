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

Hooks.once("init", () => {
  if (typeof Babele === "undefined") {
    console.warn(
      `[${MODULE_ID}] Babele module not detected. ` +
        `Install and enable "Babele" to apply Italian compendium translations.`
    );
    return;
  }

  try {
    Babele.get().register({
      module: MODULE_ID,
      lang: "it",
      dir: "compendium/it"
    });
    console.log(`[${MODULE_ID}] Italian Babele pack registered.`);
  } catch (err) {
    console.error(`[${MODULE_ID}] Failed to register Babele pack.`, err);
  }
});

Hooks.once("ready", () => {
  if (typeof Babele === "undefined") {
    ui.notifications?.warn(
      `Poké Role - Italiano: il modulo Babele non è attivo. ` +
        `Installa e abilita Babele per applicare le traduzioni italiane dei compendi.`
    );
  }
});
