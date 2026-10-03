import type { CardData, ItemSource, Kind, LoreEntry, Lorebook, PersonaData, VaultItem } from "./types";

let seq = 0;

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "item"
  );
}

function nextId(kind: Kind, name: string): string {
  seq += 1;
  return `${kind}-${slug(name)}-${seq}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function asStringList(value: unknown): string[] {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed.map((item) => asString(item).trim()).filter(Boolean);
  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function blurbFrom(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= 140) return line;
  return `${line.slice(0, 137).trimEnd()}…`;
}

function normalizeEntry(raw: unknown, index: number): LoreEntry | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const keys = asStringList(entry.keys ?? entry.key);
  const secondary = asStringList(entry.secondary_keys ?? entry.keysecondary);
  const content = asString(entry.content);
  if (!content && keys.length === 0) return null;
  const positionRaw = entry.position;
  const position =
    positionRaw === "after_char" || positionRaw === 1 || positionRaw === "1" ? "after_char" : "before_char";
  const enabled = entry.enabled !== false && entry.disable !== true && entry.disabled !== true;
  return {
    keys,
    secondary_keys: secondary,
    content,
    comment: asString(entry.comment || entry.name || keys[0] || `Entry ${index + 1}`),
    enabled,
    constant: Boolean(entry.constant),
    selective: entry.selective !== undefined ? Boolean(entry.selective) : secondary.length > 0,
    insertion_order: Number(entry.insertion_order ?? entry.order ?? entry.priority ?? 100) || 0,
    position,
  };
}

export function normalizeBook(raw: unknown, fallbackName: string): Lorebook | null {
  const parsed = parseMaybeJson(raw);
  const book = asRecord(parsed);
  if (!book) return null;
  const rawEntries = parseMaybeJson(book.entries);
  const list = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries && typeof rawEntries === "object"
      ? Object.values(rawEntries as Record<string, unknown>)
      : [];
  const entries = list.map(normalizeEntry).filter((entry): entry is LoreEntry => Boolean(entry));
  const name = asString(book.name) || fallbackName;
  if (!entries.length && !name) return null;
  return {
    name,
    description: asString(book.description),
    scan_depth: Number(book.scan_depth ?? 2) || 2,
    token_budget: Number(book.token_budget ?? 512) || 512,
    recursive_scanning: Boolean(book.recursive_scanning),
    entries,
  };
}

function cardDataFrom(raw: Record<string, unknown>): CardData {
  const nested = asRecord(raw.data);
  const data = nested ?? raw;
  const book = normalizeBook(parseMaybeJson(data.character_book), `${asString(data.name) || "Character"} lore`);
  return {
    name: asString(data.name, "Untitled"),
    nickname: asString(data.nickname),
    description: asString(data.description),
    personality: asString(data.personality),
    scenario: asString(data.scenario),
    first_mes: asString(data.first_mes),
    mes_example: asString(data.mes_example),
    creator_notes: asString(data.creator_notes),
    system_prompt: asString(data.system_prompt),
    post_history_instructions: asString(data.post_history_instructions),
    alternate_greetings: asStringList(data.alternate_greetings),
    tags: asStringList(data.tags),
    creator: asString(data.creator),
    character_version: asString(data.character_version, "1.0"),
    character_book: book && book.entries.length ? book : null,
  };
}

function isBundle(raw: Record<string, unknown>): boolean {
  if (raw.spec === "vellum_bundle_v1") return true;
  const hasCollections = "cards" in raw || "lorebooks" in raw || "personas" in raw;
  return hasCollections && !("data" in raw) && !("first_mes" in raw) && !("entries" in raw);
}

function isCard(raw: Record<string, unknown>): boolean {
  const spec = asString(raw.spec);
  if (spec.startsWith("chara_card")) return true;
  if (raw.rawSpec && asString(raw.rawSpec).startsWith("chara_card")) return true;
  const data = asRecord(raw.data) ?? raw;
  const hasIdentity = Boolean(asString(data.name));
  const hasCardField =
    "first_mes" in data ||
    "personality" in data ||
    "character_book" in data ||
    "mes_example" in data ||
    "scenario" in data;
  return hasIdentity && hasCardField && !isWorld(raw);
}

function isWorld(raw: Record<string, unknown>): boolean {
  if (asString(raw.spec).startsWith("chara_card")) return false;
  if ("first_mes" in raw || "personality" in raw) return false;
  const entries = parseMaybeJson(raw.entries);
  if (Array.isArray(entries)) return entries.length > 0;
  if (entries && typeof entries === "object") return Object.keys(entries as object).length > 0;
  return false;
}

function isPersona(raw: Record<string, unknown>): boolean {
  if (raw.kind === "persona") return true;
  const hasName = Boolean(asString(raw.name));
  const hasDescription = "description" in raw;
  const cardish = "first_mes" in raw || "personality" in raw || "character_book" in raw || "entries" in raw;
  return hasName && hasDescription && !cardish;
}

function itemBase(kind: Kind, name: string, source: ItemSource, tags: string[], blurb: string, creator: string, nsfw: boolean) {
  return {
    id: nextId(kind, name),
    kind,
    name,
    creator,
    tags,
    blurb,
    nsfw,
    source,
  };
}

function cardItem(raw: Record<string, unknown>, source: ItemSource): VaultItem {
  const card = cardDataFrom(raw);
  const tags = card.tags;
  const nsfw = tags.some((tag) => /^(nsfw|nsfl|mature)$/i.test(tag)) || Boolean(raw.nsfw);
  return {
    ...itemBase("card", card.name, source, tags, blurbFrom(card.description || card.personality || card.scenario), card.creator, nsfw),
    card,
  };
}

function bookItem(raw: unknown, source: ItemSource, fallbackName: string): VaultItem | null {
  const book = normalizeBook(raw, fallbackName);
  if (!book) return null;
  const record = asRecord(parseMaybeJson(raw));
  const tags = asStringList(record?.tags);
  return {
    ...itemBase("lorebook", book.name || fallbackName, source, tags, blurbFrom(book.description || book.entries[0]?.content || ""), asString(record?.creator), false),
    book,
  };
}

function personaItem(raw: Record<string, unknown>, source: ItemSource): VaultItem {
  const persona: PersonaData = {
    name: asString(raw.name, "Persona"),
    title: asString(raw.title || raw.name),
    description: asString(raw.description),
    lorebookName: asString(raw.lorebookName || raw.lorebook),
  };
  const book = normalizeBook(raw.book ?? raw.lorebook_data ?? raw.character_book, persona.lorebookName);
  return {
    ...itemBase("persona", persona.name, source === "vault" ? "persona" : source, asStringList(raw.tags), blurbFrom(persona.description), asString(raw.creator), false),
    persona,
    book: book && book.entries.length ? book : undefined,
  };
}

export function adaptPayload(input: unknown, source: ItemSource = "bundle"): VaultItem[] {
  if (Array.isArray(input)) return input.flatMap((entry) => adaptPayload(entry, source));
  const raw = asRecord(input);
  if (!raw) return [];

  if (raw.kind === "card" && asRecord(raw.card)) return [cardItem(asRecord(raw.card) as Record<string, unknown>, source)];
  if (raw.kind === "lorebook" && raw.book) {
    const item = bookItem(raw.book, source, asString(raw.name, "Lorebook"));
    return item ? [item] : [];
  }
  if (raw.kind === "persona") {
    const persona = asRecord(raw.persona) ?? raw;
    return [personaItem(persona, source)];
  }

  if (isBundle(raw)) {
    const cards = Array.isArray(raw.cards) ? raw.cards.flatMap((entry) => adaptPayload(entry, "bundle")) : [];
    const books = Array.isArray(raw.lorebooks)
      ? raw.lorebooks.flatMap((entry) => {
          const item = bookItem(entry, "bundle", "Lorebook");
          return item ? [item] : [];
        })
      : [];
    const personas = Array.isArray(raw.personas) ? raw.personas.flatMap((entry) => adaptPayload(entry, "persona")) : [];
    return [...cards, ...books, ...personas];
  }

  if (isCard(raw)) return [cardItem(raw, source)];
  if (isWorld(raw)) {
    const item = bookItem(raw, source, asString(raw.name, "Lorebook"));
    return item ? [item] : [];
  }
  if (isPersona(raw)) return [personaItem(raw, source)];
  return [];
}

export const SAMPLE_ARCHIVES = {
  name: "June Pell",
  creator: "the-archives",
  description: "Keeps an inn at the end of a road that mapmakers keep forgetting. Remembers every order. Forgets every name on purpose.",
  personality: "Dry, hospitable, impossible to hurry. Speaks as if the kettle is the one making the decisions.",
  scenario: "Rain, late. The sign over the door is only a painted bowl. {{user}} is the only guest tonight.",
  first_mes: "Bowl's hot. Don't tell me your name unless you want it written in the book, and the book has opinions.",
  tags: ["scenario:inn", "original"],
  character_book: {
    name: "Pell Inn",
    entries: [
      {
        keys: ["the book", "guest book"],
        content: "The guest book writes back. Names left in it can be called from the road on storm nights.",
        insertion_order: 100,
      },
    ],
  },
};

export const SAMPLE_WORLD = {
  name: "Lampward ordinances",
  description: "What the night city actually enforces.",
  entries: {
    "0": {
      uid: 0,
      key: ["lampward", "the ward"],
      comment: "Lampward",
      content: "Lampward is the district where the gaslamps are a legal requirement, not a courtesy. Unlit streets are treated as closed.",
      order: 100,
      disable: false,
      constant: false,
    },
  },
};

export const SAMPLE_EDITOR = {
  spec: "chara_card_v3",
  spec_version: "3.0",
  data: {
    name: "Neri Ash",
    creator: "vellum-card-editor",
    description: "Cartographer of places that are not on maps yet. Files reports, not stories.",
    personality: "Precise, mildly impatient with metaphor, fond of margins.",
    scenario: "A survey table, a wet map, and a margin note that was not there an hour ago.",
    first_mes: "Stand still. If you move, the margin moves, and I have already measured it once.",
    mes_example: "",
    tags: ["character", "original"],
    character_version: "1.0",
    character_book: null,
  },
};
