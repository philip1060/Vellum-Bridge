import type { CardData, LoreEntry, Lorebook, PersonaData, StPayload, VaultItem } from "./types";

export function toCharacterCard(card: CardData, id: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: card.name,
    nickname: card.nickname,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    first_mes: card.first_mes,
    mes_example: card.mes_example,
    creator_notes: card.creator_notes,
    system_prompt: card.system_prompt,
    post_history_instructions: card.post_history_instructions,
    alternate_greetings: card.alternate_greetings,
    tags: card.tags,
    creator: card.creator,
    character_version: card.character_version,
    extensions: { vellum: { id, bridge: "vellum-bridge" } },
  };
  if (card.character_book && card.character_book.entries.length) {
    data.character_book = toEmbeddedBook(card.character_book);
  }
  return { spec: "chara_card_v3", spec_version: "3.0", data };
}

export function toV2Card(v3: Record<string, unknown>): Record<string, unknown> {
  return { spec: "chara_card_v2", spec_version: "2.0", data: v3.data };
}

export function personaToCard(item: VaultItem): Record<string, unknown> {
  const persona = item.persona ?? {
    name: item.name,
    title: item.name,
    description: item.blurb,
    lorebookName: "",
  };
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: persona.name,
      description: persona.description,
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: item.tags,
      creator: item.creator,
      character_version: "1.0",
      extensions: {
        vellum_persona: {
          title: persona.title || persona.name,
          lorebook: persona.lorebookName || "",
        },
      },
    },
  };
}

export function toLorebookV3(book: Lorebook) {
  return {
    spec: "lorebook_v3",
    data: {
      name: book.name,
      description: book.description,
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: book.recursive_scanning,
      entries: book.entries.map((entry) => ({
        keys: entry.keys,
        secondary_keys: entry.secondary_keys,
        content: entry.content,
        comment: entry.comment,
        enabled: entry.enabled,
        constant: entry.constant,
        selective: entry.selective,
        insertion_order: entry.insertion_order,
        position: entry.position,
      })),
    },
  };
}

function toEmbeddedBook(book: Lorebook) {
  return {
    name: book.name,
    description: book.description,
    scan_depth: book.scan_depth,
    token_budget: book.token_budget,
    recursive_scanning: book.recursive_scanning,
    extensions: {},
    entries: book.entries.map((entry, index) => ({
      id: index,
      keys: entry.keys,
      secondary_keys: entry.secondary_keys,
      content: entry.content,
      comment: entry.comment,
      name: entry.comment,
      enabled: entry.enabled,
      constant: entry.constant,
      selective: entry.selective,
      insertion_order: entry.insertion_order,
      priority: entry.insertion_order,
      position: entry.position,
      case_sensitive: false,
      extensions: {},
    })),
  };
}

export function toWorldInfo(book: Lorebook): { entries: Record<string, Record<string, unknown>> } {
  const entries: Record<string, Record<string, unknown>> = {};
  book.entries.forEach((entry, index) => {
    entries[String(index)] = worldEntry(entry, index);
  });
  return { entries };
}

function worldEntry(entry: LoreEntry, index: number): Record<string, unknown> {
  return {
    uid: index,
    key: entry.keys,
    keysecondary: entry.secondary_keys,
    comment: entry.comment || entry.keys[0] || `Entry ${index + 1}`,
    content: entry.content,
    constant: entry.constant,
    selective: entry.selective,
    order: entry.insertion_order,
    position: entry.position === "after_char" ? 1 : 0,
    disable: !entry.enabled,
    displayIndex: index,
    addMemo: true,
    group: "",
    groupOverride: false,
    groupWeight: 100,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    probability: 100,
    depth: 4,
    useProbability: true,
    role: null,
    vectorized: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: "",
    extensions: {},
  };
}

export function toSillyTavern(item: VaultItem): StPayload {
  if (item.kind === "card" && item.card) {
    const book = item.card.character_book;
    return {
      id: item.id,
      kind: "card",
      name: item.name,
      card: toCharacterCard(item.card, item.id),
      world: book && book.entries.length ? toWorldInfo(book) : null,
      worldName: book && book.entries.length ? book.name || `${item.name} lore` : null,
      persona: null,
    };
  }
  if (item.kind === "lorebook" && item.book) {
    return {
      id: item.id,
      kind: "lorebook",
      name: item.name,
      card: null,
      world: toWorldInfo(item.book),
      worldName: item.book.name || item.name,
      persona: null,
    };
  }
  const persona: PersonaData = item.persona ?? {
    name: item.name,
    title: item.name,
    description: item.blurb,
    lorebookName: "",
  };
  const book = item.book;
  return {
    id: item.id,
    kind: "persona",
    name: item.name,
    card: personaToCard({ ...item, persona }),
    world: book && book.entries.length ? toWorldInfo(book) : null,
    worldName: persona.lorebookName || (book ? book.name : null),
    persona,
  };
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "import").slice(0, 80);
}
