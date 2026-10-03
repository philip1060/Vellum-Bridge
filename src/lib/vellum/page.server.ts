import vm from "node:vm";
import { adaptPayload } from "./adapt";
import type { VaultItem } from "./types";

export function readVellumLoader(html: string): Record<string, unknown> | null {
  const start = html.indexOf('<script class="$tsr"');
  if (start === -1) return null;
  const open = html.indexOf(">", start);
  const end = html.indexOf("</script>", open);
  if (open === -1 || end === -1) return null;
  const code = html.slice(open + 1, end);
  const sandbox: Record<string, unknown> = {
    document: { currentScript: { remove() {} } },
  };
  sandbox.self = sandbox;
  vm.runInNewContext(code, sandbox, { timeout: 2000 });
  const tsr = sandbox.$_TSR as { router?: { matches?: Array<{ l?: Record<string, unknown> }> } } | undefined;
  for (const match of tsr?.router?.matches ?? []) {
    const loader = match.l;
    if (loader && (loader.card || loader.book || loader.persona)) return loader;
  }
  return null;
}

function camelCard(card: Record<string, unknown>) {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    nsfw: card.nsfw,
    data: {
      name: card.name,
      nickname: card.nickname,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.firstMes ?? card.first_mes,
      mes_example: card.mesExample ?? card.mes_example,
      creator_notes: card.creatorNotes ?? card.creator_notes,
      system_prompt: card.systemPrompt ?? card.system_prompt,
      post_history_instructions: card.postHistoryInstructions ?? card.post_history_instructions,
      alternate_greetings: card.alternateGreetings ?? card.alternate_greetings,
      tags: card.tags,
      creator: card.creator,
      character_version: card.characterVersion ?? card.character_version,
      character_book: card.characterBook ?? card.character_book,
    },
  };
}

export function itemsFromLoader(loader: Record<string, unknown>): VaultItem[] {
  const card = loader.card;
  if (card && typeof card === "object") {
    const record = card as Record<string, unknown>;
    const json =
      record.cardJson && typeof record.cardJson === "object"
        ? { ...(record.cardJson as Record<string, unknown>), nsfw: record.nsfw }
        : camelCard(record);
    return adaptPayload(json, "vault");
  }
  const book = loader.book;
  if (book && typeof book === "object") {
    const record = book as Record<string, unknown>;
    const json = record.bookJson ?? record;
    return adaptPayload(json, "vault").map((item) => ({
      ...item,
      kind: "lorebook" as const,
      name: typeof record.name === "string" && record.name ? record.name : item.name,
    }));
  }
  const persona = loader.persona;
  if (persona && typeof persona === "object") {
    const record = persona as Record<string, unknown>;
    return adaptPayload(
      {
        kind: "persona",
        name: record.name,
        description: record.description,
        title: record.summary || record.name,
        lorebookName: "",
        tags: record.tags,
        creator: record.creator,
        nsfw: record.nsfw,
      },
      "persona",
    );
  }
  return [];
}

export function portraitPath(loader: Record<string, unknown>): string | null {
  const card = loader.card as Record<string, unknown> | undefined;
  const persona = loader.persona as Record<string, unknown> | undefined;
  const path = card?.imageUrl || persona?.avatarUrl;
  return typeof path === "string" && path ? path : null;
}
