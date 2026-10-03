# Vellum Bridge

SillyTavern extension that imports character cards, lorebooks, and personas from a Vellum vault.

## Install

1. Unzip this folder so it is named `vellum-bridge` (the manifest must sit directly inside it).
2. Move it to `SillyTavern/public/scripts/extensions/third-party/vellum-bridge`.
   For one user only, use `SillyTavern/data/<handle>/extensions/vellum-bridge` instead.
3. Restart SillyTavern.
4. Open Extensions and expand **Vellum Bridge**.

## Use

- Paste the central vault address, and optionally your own Vellum or Archives address. Refresh, tick what you want, and import.
- **Import link** takes a Vellum address: `/c/` for a character, `/l/` for a lorebook, `/p/` for a persona. The bridge address above is what fetches the page.
- **Import file** takes a tavern PNG, a world JSON, or a lorebook v3 file. **Import file as persona** reads the description field and makes a persona, even from an ordinary character PNG.
- **Export** writes whatever is open in SillyTavern. Characters export as a tavern PNG or card JSON. Lorebooks export as world JSON or lorebook v3. Personas export as a tavern PNG or the same card JSON. The description in that file is the persona description, so SillyTavern can still import the PNG as a character.

The folder name has to stay `vellum-bridge`.
