# Vellum for SillyTavern

Paste a Vellum link, press **Add**. Characters, lorebooks and personas land in SillyTavern the same way they would if you dropped the file in yourself.

No bridge site: the extension talks to Vellum's own API with a read-only key.

## Install

1. In SillyTavern open **Extensions → Install extension** and paste
   `https://github.com/philip1060/Vellum-Bridge`
   (the repository has to be public for this; otherwise download it and put the folder in
   `SillyTavern/public/scripts/extensions/third-party/`).
2. On Vellum, open **Settings → API keys** and make a key.
3. In SillyTavern open **Extensions → Vellum → API key**, paste it, and press **Check**.

## Use

- **Paste and Add.** Paste one or more links, such as `https://vellum.thecentralempire.com/c/123` for a character, `/l/123` for a lorebook or `/p/123` for a persona, and press **Add** (or Enter).
- **Feather button.** The feather beside *Import from external URL* in the character list opens the same box.
- **`/vellum <link>`** does the same thing as a slash command.
- **Browse Vellum** searches the shelf (newest, most loved, most downloaded), or shows **My favorites**, and adds with one click or **Add all shown**.

What you get:

| Link | Becomes |
| --- | --- |
| `/c/…` | A character with its portrait, tags, greetings and embedded lorebook (SillyTavern asks about the lorebook as usual). |
| `/l/…` | A World Info lorebook. |
| `/p/…` | A persona with its picture, description and title. Adding it again updates it. |

What the key can see follows your Ratings and blacklist settings on Vellum, so NSFW only shows up if you have it turned on there.

## Waiting on Vellum

Two parts depend on changes to Vellum itself, written up in [docs/vellum-api-changes.md](docs/vellum-api-changes.md):

- **Portraits.** Until Vellum's pictures allow cross-site reads, characters and personas get a placeholder picture and a notice.
- **My favorites.** Until Vellum offers `/api/v1/me/favorites/...`, Browse says favorites aren't available yet.

Neither needs an extension update; both start working as soon as Vellum ships the change.
