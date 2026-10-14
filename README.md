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
- **Vellum buttons** (feather icon) sit in the character list next to *Import from external URL*, in **Persona Management** next to *Create*, and in **World Info** next to *Import*. Each opens the same paste box.
- **`/vellum <link>`** does the same thing as a slash command.
- **Browse Vellum** searches the shelf (newest, most loved, most downloaded), or shows **My favorites**, and adds with one click or **Add all shown**.

What you get:

| Link | Becomes |
| --- | --- |
| `/c/…` | A character with its portrait, tags, greetings and embedded lorebook (SillyTavern asks about the lorebook as usual). Tags drop Vellum's category prefix, so `general:female` becomes `female`. |
| `/l/…` | A World Info lorebook. |
| `/p/…` | A persona with its picture, description and title. Adding it again updates it. |

## Persona PNGs

In **Persona Management**:

- **Export** (the file-export icon beside the open persona's Rename / Duplicate buttons) saves the persona as a PNG.
- **Import** (beside *Create*) turns a PNG into a persona. That can be a persona export, or any ordinary character card.

The PNG is a normal SillyTavern character card, so it works without this extension too:

- **Name and picture:** the persona's own.
- **Description:** has `{{user}}` and `{{char}}` swapped, so it reads correctly as a card.
- **Linked lorebook:** embedded the way SillyTavern embeds a character's lorebook.
- **Title, prompt position, depth and role:** kept in `data.extensions.persona`. The extension restores them on import.

Someone without the extension can drop the PNG into the character list and use SillyTavern's **Convert to Persona** (saying yes to swapping the macros). The card's Creator's Notes explain that.

What the key can see follows your Ratings and blacklist settings on Vellum, so NSFW only shows up if you have it turned on there.

## Vellum side

Portraits and **My favorites** (characters, lorebooks and personas) rely on Vellum's API changes described in [docs/vellum-api-changes.md](docs/vellum-api-changes.md), which are now live. If your Vellum is older than that, the extension still works: pictures fall back to a placeholder, and Browse says favorites aren't offered yet.
