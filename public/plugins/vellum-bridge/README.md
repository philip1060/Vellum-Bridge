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
- Or export a bundle from the bridge site and use **Import bundle**. That is the path for a private shelf SillyTavern cannot reach.
- Cards are written with **Import Character**. Lorebooks are saved as World Info. Personas are created with an avatar and an attached lorebook when the shelf had one.

The folder name has to stay `vellum-bridge`.
