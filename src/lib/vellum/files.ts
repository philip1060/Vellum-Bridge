import { extractCharacterJson, injectTextChunk, utf8ToBase64 } from "./png";
import { toSillyTavern, toV2Card, safeFileName } from "./st";
import type { VaultItem } from "./types";
import { textFile, zipStore, asArrayBuffer } from "./zip";

function hashName(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function renderPortrait(name: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  if (!g) return Promise.reject(new Error("Could not draw a portrait"));
  const lift = 22 + (hashName(name) % 18);
  g.fillStyle = `rgb(${lift + 10}, ${lift + 8}, ${lift + 4})`;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f4f0e8";
  g.fillRect(48, 250, 416, 2);
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
  g.font = "560 168px Fraunces, Palatino, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(initials, 256, 190);
  g.font = "500 28px Fraunces, Palatino, serif";
  g.fillText(name.slice(0, 28), 256, 312);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw a portrait"))), "image/png");
  });
}

export async function cardPng(name: string, v3: Record<string, unknown>): Promise<Blob> {
  const portrait = await renderPortrait(name);
  let buffer = await portrait.arrayBuffer();
  const v2 = toV2Card(v3);
  buffer = injectTextChunk(buffer, "chara", utf8ToBase64(JSON.stringify(v2)));
  buffer = injectTextChunk(buffer, "ccv3", utf8ToBase64(JSON.stringify(v3)));
  return new Blob([buffer], { type: "image/png" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadItem(item: VaultItem) {
  const st = toSillyTavern(item);
  if (item.kind === "card" && st.card) {
    saveBlob(await cardPng(item.name, st.card), `${safeFileName(item.name)}.png`);
    return;
  }
  if (st.world) {
    saveBlob(
      new Blob([JSON.stringify(st.world, null, 2)], { type: "application/json" }),
      `${safeFileName(st.worldName || item.name)}.json`,
    );
    return;
  }
  saveBlob(
    new Blob([JSON.stringify(st.persona, null, 2)], { type: "application/json" }),
    `${safeFileName(item.name)}.persona.json`,
  );
}

const PACK_README = `Vellum Bridge pack

bundle.json is the one file the Vellum Bridge plugin imports. It writes cards, lorebooks, and personas for you.

If you are not using the plugin:
- sillytavern/characters/*.png  → Characters → Import
- sillytavern/worlds/*.json     → World Info → Import
Personas have no file import in SillyTavern. Use the plugin for those.
`;

export async function downloadPack(items: VaultItem[]) {
  const bundle = {
    spec: "vellum_bundle_v1",
    exportedAt: new Date().toISOString(),
    cards: [] as Record<string, unknown>[],
    lorebooks: [] as VaultItem["book"][],
    personas: [] as NonNullable<VaultItem["persona"]>[],
  };
  const files = [textFile("README.txt", PACK_README)];
  for (const item of items) {
    const st = toSillyTavern(item);
    if (item.kind === "card" && st.card && item.card) {
      bundle.cards.push(st.card);
      const png = new Uint8Array(await (await cardPng(item.name, st.card)).arrayBuffer());
      files.push({ name: `sillytavern/characters/${safeFileName(item.name)}.png`, data: png });
    }
    if (item.kind === "lorebook" && item.book) bundle.lorebooks.push(item.book);
    if (item.kind === "persona" && item.persona) {
      bundle.personas.push(item.persona);
      files.push(
        textFile(`sillytavern/personas/${safeFileName(item.name)}.json`, JSON.stringify(item.persona, null, 2)),
      );
    }
    if (st.world && st.worldName && item.kind !== "persona") {
      files.push(textFile(`sillytavern/worlds/${safeFileName(st.worldName)}.json`, JSON.stringify(st.world, null, 2)));
    }
    if (item.kind === "persona" && st.world && st.worldName) {
      files.push(textFile(`sillytavern/worlds/${safeFileName(st.worldName)}.json`, JSON.stringify(st.world, null, 2)));
    }
  }
  files.splice(1, 0, textFile("bundle.json", JSON.stringify(bundle, null, 2)));
  saveBlob(new Blob([asArrayBuffer(zipStore(files))], { type: "application/zip" }), "vellum-pack.zip");
}

export async function readDroppedFile(file: File): Promise<unknown> {
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    const json = extractCharacterJson(await file.arrayBuffer());
    if (!json) throw new Error(`${file.name} has no character card in it`);
    return json;
  }
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${file.name} is not JSON or a card PNG`);
  }
}
