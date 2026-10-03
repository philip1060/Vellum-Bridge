export type Kind = "card" | "lorebook" | "persona";

export type ItemSource = "vault" | "archives" | "editor" | "bundle" | "persona";

export interface LoreEntry {
  keys: string[];
  secondary_keys: string[];
  content: string;
  comment: string;
  enabled: boolean;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  position: "before_char" | "after_char";
}

export interface Lorebook {
  name: string;
  description: string;
  scan_depth: number;
  token_budget: number;
  recursive_scanning: boolean;
  entries: LoreEntry[];
}

export interface CardData {
  name: string;
  nickname: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  character_book: Lorebook | null;
}

export interface PersonaData {
  name: string;
  title: string;
  description: string;
  lorebookName: string;
}

export interface VaultItem {
  id: string;
  kind: Kind;
  name: string;
  creator: string;
  tags: string[];
  blurb: string;
  nsfw: boolean;
  source: ItemSource;
  card?: CardData;
  book?: Lorebook;
  persona?: PersonaData;
}

export interface StPayload {
  id: string;
  kind: Kind;
  name: string;
  card: Record<string, unknown> | null;
  world: { entries: Record<string, Record<string, unknown>> } | null;
  worldName: string | null;
  persona: PersonaData | null;
}
