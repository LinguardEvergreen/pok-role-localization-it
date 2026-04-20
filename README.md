# Poké Role System - Italiano

Modulo di localizzazione italiana per il sistema FoundryVTT [**Pok-Role-Module**](https://github.com/RiccardoMont1/Pok-Role-Module).

Traduce in italiano nomi e descrizioni di Mosse, Abilità, Strumenti, Condizioni Meteo e Stati Alterati contenuti nei compendi del sistema, usando la terminologia ufficiale della [Pokémon Central Wiki](https://wiki.pokemoncentral.it/).

I nomi originali inglesi vengono **preservati come identificatori interni**: schede Pokémon, link, macro e riferimenti esistenti continuano a funzionare anche se l'interfaccia mostra i nomi in italiano. Questo è possibile grazie al modulo [Babele](https://foundryvtt.com/packages/babele), che è un prerequisito obbligatorio.

## Requisiti

| Dipendenza | Versione minima |
|---|---|
| FoundryVTT | v13 (verificato su build 351) |
| Sistema `pok-role-system` | 1.3.0 |
| Modulo `babele` | 2.0.0 |

## Installazione

1. Installa e abilita il modulo [**Babele**](https://foundryvtt.com/packages/babele) nel tuo mondo.
2. Installa questo modulo tramite il manifest URL:
   ```
   https://raw.githubusercontent.com/LinguardEvergreen/pok-role-localization-it/main/module.json
   ```
   Oppure clona/scarica il repository dentro la cartella `Data/modules/pok-role-localization-it` della tua installazione FoundryVTT.
3. Abilita il modulo nelle impostazioni del mondo.
4. Ricarica il mondo. I compendi del sistema saranno ora visualizzati in italiano.

## Cosa viene tradotto

| Pack del sistema | File di traduzione | Voci |
|---|---|---|
| `abilities` | `compendium/it/abilities.json` | 305 |
| `moves` | `compendium/it/moves.json` | 894 |
| `held-items` | `compendium/it/held-items.json` | 142 |
| `trainer-items` | `compendium/it/trainer-items.json` | 33 |
| `healing-items` | `compendium/it/healing-items.json` | 33 |
| `pokemon-care-items` | `compendium/it/pokemon-care-items.json` | 15 |
| `evolutionary-items` | `compendium/it/evolutionary-items.json` | 10 |
| `pokemon-status` | `compendium/it/pokemon-status.json` | 9 |
| `weather-conditions` | `compendium/it/weather-conditions.json` | 7 |

Il pack `pokemon-actors` **non viene tradotto**: i nomi delle specie Pokémon restano nella forma ufficiale internazionale (identica tra italiano e inglese dalla prima generazione).

## Come funziona

Al caricamento di FoundryVTT, il modulo registra presso Babele la directory `compendium/it` contenente un file JSON per ciascun pack del sistema. Ogni file segue il formato Babele standard:

```json
{
  "label": "Mosse",
  "entries": {
    "<Nome Inglese Originale>": {
      "name": "<Nome Italiano>",
      "description": "<Descrizione Italiana>",
      "system.effect": "<Effetto meccanico tradotto>"
    }
  }
}
```

Babele intercetta la lettura dei documenti dei compendi e sostituisce al volo i campi `name`, `description` e simili con la versione italiana, **senza toccare i documenti originali**. Le chiavi di lookup usate dalle schede Pokémon restano quelle inglesi, garantendo piena retro-compatibilità.

## Struttura della repository

```
pok-role-localization-it/
├── module.json                      # Manifest FoundryVTT
├── pok-role-localization-it.mjs     # Bootstrap ESM (registra Babele)
├── lang/
│   └── it.json                      # Stringhe UI del modulo
├── compendium/it/
│   ├── abilities.json               # Traduzioni pack per pack
│   ├── moves.json
│   ├── held-items.json
│   ├── trainer-items.json
│   ├── healing-items.json
│   ├── pokemon-care-items.json
│   ├── evolutionary-items.json
│   ├── pokemon-status.json
│   └── weather-conditions.json
├── data/extracted/                  # Dump delle fonti (per script/diff)
└── scripts/
    ├── extract-names.mjs            # Dump nomi dai seed del sistema
    └── extract-static-items.mjs     # Dump strumenti statici
```

## Contribuire

Per segnalare nomi errati o proporre miglioramenti nelle traduzioni, apri una issue o una pull request. La fonte di riferimento per i nomi canonici è la [Pokémon Central Wiki](https://wiki.pokemoncentral.it/).

## Licenza

MIT. Le denominazioni, immagini e concetti Pokémon sono di proprietà di Nintendo, Game Freak, Creatures Inc. e The Pokémon Company. Questo modulo è un progetto fan-made non ufficiale.
