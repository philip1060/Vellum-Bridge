import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as FolderOpen, c as ArrowLeftRight, i as Library, n as Search, o as Download, r as Puzzle, s as ArrowLeft } from "../_libs/lucide-react.mjs";
import { a as toV2Card, c as zipStore, d as SAMPLE_WORLD, f as adaptPayload, i as toSillyTavern, l as SAMPLE_ARCHIVES, n as VAULT, o as asArrayBuffer, r as safeFileName, s as textFile, u as SAMPLE_EDITOR } from "./router-1dLXugI8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BWslpkBA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** PNG tEXt injector for SillyTavern `chara` and `ccv3` chunks. Pure, no DOM. */
function crc32(buf) {
	let c = 4294967295;
	for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ c >>> 8;
	return (c ^ 4294967295) >>> 0;
}
var CRC = (() => {
	const t = /* @__PURE__ */ new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		t[n] = c;
	}
	return t;
})();
function readUint32BE(view, offset) {
	return view.getUint32(offset, false);
}
function writeUint32BE(arr, offset, value) {
	arr[offset] = value >>> 24 & 255;
	arr[offset + 1] = value >>> 16 & 255;
	arr[offset + 2] = value >>> 8 & 255;
	arr[offset + 3] = value & 255;
}
function extractTextChunks(pngBuffer) {
	const bytes = new Uint8Array(pngBuffer);
	const view = new DataView(pngBuffer);
	if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error("Not a PNG file");
	const chunks = [];
	let offset = 8;
	while (offset + 12 <= bytes.length) {
		const length = readUint32BE(view, offset);
		const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
		const dataStart = offset + 8;
		const dataEnd = dataStart + length;
		if (dataEnd + 4 > bytes.length) break;
		if (type === "tEXt") {
			const data = bytes.subarray(dataStart, dataEnd);
			const nullIdx = data.indexOf(0);
			if (nullIdx !== -1) chunks.push({
				keyword: new TextDecoder().decode(data.subarray(0, nullIdx)),
				text: new TextDecoder().decode(data.subarray(nullIdx + 1))
			});
		} else if (type === "IEND") break;
		offset = dataEnd + 4;
	}
	return chunks;
}
function parseChunkText(text) {
	try {
		return JSON.parse(text);
	} catch {}
	try {
		const binary = atob(text);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return null;
	}
}
function extractCharacterJson(pngBuffer) {
	const chunks = extractTextChunks(pngBuffer);
	for (const keyword of ["ccv3", "chara"]) {
		const chunk = chunks.find((c) => c.keyword.toLowerCase() === keyword);
		if (!chunk) continue;
		const json = parseChunkText(chunk.text);
		if (json) return json;
	}
	return null;
}
function injectTextChunk(pngBuffer, keyword, text) {
	const bytes = new Uint8Array(pngBuffer);
	const view = new DataView(pngBuffer);
	if (bytes[0] !== 137 || bytes[1] !== 80) throw new Error("Not a PNG file");
	const kept = [];
	let offset = 8;
	while (offset + 12 <= bytes.length) {
		const length = readUint32BE(view, offset);
		const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
		const dataStart = offset + 8;
		const dataEnd = dataStart + length;
		if (dataEnd + 4 > bytes.length) break;
		const data = bytes.subarray(dataStart, dataEnd);
		if (type === "tEXt") {
			const nullIdx = data.indexOf(0);
			if (nullIdx !== -1) {
				if (new TextDecoder().decode(data.subarray(0, nullIdx)).toLowerCase() === keyword.toLowerCase()) {
					offset = dataEnd + 4;
					continue;
				}
			}
		}
		if (type === "IEND") break;
		kept.push({
			type,
			data: new Uint8Array(data)
		});
		offset = dataEnd + 4;
	}
	const keywordBytes = new TextEncoder().encode(keyword);
	const textBytes = new TextEncoder().encode(text);
	const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
	chunkData.set(keywordBytes, 0);
	chunkData[keywordBytes.length] = 0;
	chunkData.set(textBytes, keywordBytes.length + 1);
	const typeBytes = new TextEncoder().encode("tEXt");
	const crcBuf = new Uint8Array(4 + chunkData.length);
	crcBuf.set(typeBytes, 0);
	crcBuf.set(chunkData, 4);
	const crc = crc32(crcBuf);
	let total = 20 + chunkData.length + 12;
	for (const c of kept) total += 12 + c.data.length;
	const out = new Uint8Array(total);
	out.set(bytes.subarray(0, 8), 0);
	let pos = 8;
	const writeChunk = (type, data) => {
		writeUint32BE(out, pos, data.length);
		pos += 4;
		const tb = new TextEncoder().encode(type);
		out.set(tb, pos);
		pos += 4;
		out.set(data, pos);
		pos += data.length;
		const buf = new Uint8Array(4 + data.length);
		buf.set(tb, 0);
		buf.set(data, 4);
		writeUint32BE(out, pos, crc32(buf));
		pos += 4;
	};
	for (const c of kept) writeChunk(c.type, c.data);
	writeUint32BE(out, pos, chunkData.length);
	pos += 4;
	out.set(typeBytes, pos);
	pos += 4;
	out.set(chunkData, pos);
	pos += chunkData.length;
	writeUint32BE(out, pos, crc);
	pos += 4;
	writeChunk("IEND", /* @__PURE__ */ new Uint8Array(0));
	return out.buffer;
}
function utf8ToBase64(text) {
	const bytes = new TextEncoder().encode(text);
	const parts = [];
	for (let i = 0; i < bytes.length; i += 32768) {
		const slice = bytes.subarray(i, i + 32768);
		let bin = "";
		for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
		parts.push(bin);
	}
	return btoa(parts.join(""));
}
function hashName(name) {
	let hash = 2166136261;
	for (let i = 0; i < name.length; i++) {
		hash ^= name.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}
function renderPortrait(name) {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 512;
	const g = canvas.getContext("2d");
	if (!g) return Promise.reject(/* @__PURE__ */ new Error("Could not draw a portrait"));
	const lift = 22 + hashName(name) % 18;
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
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("Could not draw a portrait")), "image/png");
	});
}
async function cardPng(name, v3) {
	let buffer = await (await renderPortrait(name)).arrayBuffer();
	const v2 = toV2Card(v3);
	buffer = injectTextChunk(buffer, "chara", utf8ToBase64(JSON.stringify(v2)));
	buffer = injectTextChunk(buffer, "ccv3", utf8ToBase64(JSON.stringify(v3)));
	return new Blob([buffer], { type: "image/png" });
}
function saveBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
async function downloadItem(item) {
	const st = toSillyTavern(item);
	if (item.kind === "card" && st.card) {
		saveBlob(await cardPng(item.name, st.card), `${safeFileName(item.name)}.png`);
		return;
	}
	if (st.world) {
		saveBlob(new Blob([JSON.stringify(st.world, null, 2)], { type: "application/json" }), `${safeFileName(st.worldName || item.name)}.json`);
		return;
	}
	saveBlob(new Blob([JSON.stringify(st.persona, null, 2)], { type: "application/json" }), `${safeFileName(item.name)}.persona.json`);
}
var PACK_README = `Vellum Bridge pack

bundle.json is the one file the Vellum Bridge plugin imports. It writes cards, lorebooks, and personas for you.

If you are not using the plugin:
- sillytavern/characters/*.png  → Characters → Import
- sillytavern/worlds/*.json     → World Info → Import
Personas have no file import in SillyTavern. Use the plugin for those.
`;
async function downloadPack(items) {
	const bundle = {
		spec: "vellum_bundle_v1",
		exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
		cards: [],
		lorebooks: [],
		personas: []
	};
	const files = [textFile("README.txt", PACK_README)];
	for (const item of items) {
		const st = toSillyTavern(item);
		if (item.kind === "card" && st.card && item.card) {
			bundle.cards.push(st.card);
			const png = new Uint8Array(await (await cardPng(item.name, st.card)).arrayBuffer());
			files.push({
				name: `sillytavern/characters/${safeFileName(item.name)}.png`,
				data: png
			});
		}
		if (item.kind === "lorebook" && item.book) bundle.lorebooks.push(item.book);
		if (item.kind === "persona" && item.persona) {
			bundle.personas.push(item.persona);
			files.push(textFile(`sillytavern/personas/${safeFileName(item.name)}.json`, JSON.stringify(item.persona, null, 2)));
		}
		if (st.world && st.worldName && item.kind !== "persona") files.push(textFile(`sillytavern/worlds/${safeFileName(st.worldName)}.json`, JSON.stringify(st.world, null, 2)));
		if (item.kind === "persona" && st.world && st.worldName) files.push(textFile(`sillytavern/worlds/${safeFileName(st.worldName)}.json`, JSON.stringify(st.world, null, 2)));
	}
	files.splice(1, 0, textFile("bundle.json", JSON.stringify(bundle, null, 2)));
	saveBlob(new Blob([asArrayBuffer(zipStore(files))], { type: "application/zip" }), "vellum-pack.zip");
}
async function readDroppedFile(file) {
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
var SHELF_KEY = "vellum-bridge-shelf";
var TABS = [
	{
		id: "shelf",
		label: "Vault",
		icon: Library
	},
	{
		id: "mine",
		label: "Mine",
		icon: FolderOpen
	},
	{
		id: "adapters",
		label: "Adapters",
		icon: ArrowLeftRight
	},
	{
		id: "plugin",
		label: "Plugin",
		icon: Puzzle
	}
];
function matches(item, query, kind, mature) {
	if (!mature && item.nsfw) return false;
	if (kind !== "all" && item.kind !== kind) return false;
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return [
		item.name,
		item.creator,
		item.blurb,
		item.tags.join(" ")
	].join(" ").toLowerCase().includes(q);
}
function kindLabel(kind) {
	if (kind === "lorebook") return "Lorebook";
	if (kind === "persona") return "Persona";
	return "Card";
}
function monogram(name) {
	const parts = name.split(/\s+/).filter(Boolean);
	return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 1)).toUpperCase();
}
function BridgeApp() {
	const [tab, setTab] = (0, import_react.useState)("shelf");
	const [query, setQuery] = (0, import_react.useState)("");
	const [kind, setKind] = (0, import_react.useState)("all");
	const [mature, setMature] = (0, import_react.useState)(false);
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [pack, setPack] = (0, import_react.useState)([]);
	const [mine, setMine] = (0, import_react.useState)([]);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [notice, setNotice] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(SHELF_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) setMine(parsed);
			}
		} catch {}
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (ready) localStorage.setItem(SHELF_KEY, JSON.stringify(mine));
	}, [mine, ready]);
	const library = tab === "mine" ? mine : VAULT;
	const visible = (0, import_react.useMemo)(() => library.filter((item) => matches(item, query, kind, mature)), [
		library,
		query,
		kind,
		mature
	]);
	const selected = [...VAULT, ...mine].find((item) => item.id === selectedId) ?? null;
	const packed = [...VAULT, ...mine].filter((item) => pack.includes(item.id));
	function togglePack(id) {
		setPack((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
	}
	async function takeFiles(files) {
		const next = [];
		const problems = [];
		for (const file of files) try {
			const payload = await readDroppedFile(file);
			const items = adaptPayload(payload, file.name.endsWith(".png") ? "editor" : "bundle");
			if (!items.length) problems.push(`${file.name} did not match a known format`);
			next.push(...items);
		} catch (error) {
			problems.push(error instanceof Error ? error.message : `${file.name} failed`);
		}
		if (next.length) {
			setMine((current) => [...next, ...current]);
			setNotice(`${next.length} added to your shelf.`);
			setTab("mine");
			setSelectedId(next[0]?.id ?? null);
		}
		if (problems.length) setNotice(problems.join(" "));
	}
	async function runDownload(items, packFile) {
		if (!items.length || busy) return;
		setBusy(true);
		setNotice("");
		try {
			if (packFile) await downloadPack(items);
			else await downloadItem(items[0]);
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Download failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-6 pb-28",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "rise",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm tracking-widest text-muted uppercase",
						children: "Vellum"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl leading-none font-medium tracking-tight text-fg",
						children: "Bridge"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-xl text-base leading-normal text-muted",
						children: "Cards, lorebooks, and personas from your Vellum and the central vault, ready for SillyTavern."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 grid grid-cols-4 border-b border-line",
				role: "tablist",
				"aria-label": "Sections",
				children: TABS.map((item) => {
					const Icon = item.icon;
					const active = tab === item.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "tab",
						"aria-selected": active,
						className: "inline-flex min-h-11 flex-col items-center justify-center gap-1 border-b-2 px-1 py-2 text-xs font-medium sm:flex-row sm:text-sm " + (active ? "border-fg text-fg" : "border-transparent text-muted"),
						onClick: () => {
							setTab(item.id);
							setSelectedId(null);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: "size-4",
							"aria-hidden": "true"
						}), item.label]
					}, item.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mt-5 flex-1",
				children: [
					tab === "shelf" || tab === "mine" ? selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Detail, {
						item: selected,
						packed: pack.includes(selected.id),
						busy,
						onBack: () => setSelectedId(null),
						onPack: () => togglePack(selected.id),
						onDownload: () => void runDownload([selected], false)
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListView, {
						tab,
						items: visible,
						query,
						kind,
						mature,
						total: library.length,
						onQuery: setQuery,
						onKind: setKind,
						onMature: setMature,
						onOpen: setSelectedId,
						onFiles: (files) => void takeFiles(files),
						onClear: () => {
							setMine([]);
							setPack((current) => current.filter((id) => VAULT.some((item) => item.id === id)));
						}
					}) : null,
					tab === "adapters" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Adapters, { onNotice: setNotice }) : null,
					tab === "plugin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginPanel, {}) : null,
					notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted",
						role: "status",
						children: notice
					}) : null
				]
			}),
			packed.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-x-0 bottom-0 border-t border-line bg-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-3xl items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-fg",
						children: [packed.length, " in the pack"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: ghost,
							onClick: () => setPack([]),
							children: "Clear"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: solid,
							disabled: busy,
							onClick: () => void runDownload(packed, true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
								className: "size-4",
								"aria-hidden": "true"
							}), busy ? "Packing" : "Download pack"]
						})]
					})]
				})
			}) : null
		]
	});
}
var solid = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50";
var ghost = "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg";
function ListView({ tab, items, query, kind, mature, total, onQuery, onKind, onMature, onOpen, onFiles, onClear }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rise",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-medium tracking-tight",
					children: tab === "shelf" ? "Central vault" : "Your shelf"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-subtle tabular-nums",
					children: items.length === total ? total : `${items.length} of ${total}`
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm leading-normal text-muted",
				children: tab === "shelf" ? "The shared shelf. The plugin reads this once the site is published." : "Files from the card editor, The Archives, or a bundle. They stay on this device."
			}),
			tab === "mine" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center",
				onDragOver: (event) => event.preventDefault(),
				onDrop: (event) => {
					event.preventDefault();
					onFiles([...event.dataTransfer.files]);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium text-fg",
						children: "Drop cards, lorebooks, or a bundle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 text-sm text-muted",
						children: "PNG, JSON, world info, or a Vellum bundle"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sr-only",
						type: "file",
						accept: "application/json,.json,image/png,.png",
						multiple: true,
						onChange: (event) => {
							const files = [...event.target.files ?? []];
							event.target.value = "";
							if (files.length) onFiles(files);
						}
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 flex items-center gap-2 rounded-md border border-line bg-surface px-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
						className: "size-4 text-subtle",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: "Search"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: query,
						onChange: (event) => onQuery(event.target.value),
						placeholder: "Name, tag, creator",
						className: "min-h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap gap-2",
				children: [
					[
						["all", "All"],
						["card", "Cards"],
						["lorebook", "Lorebooks"],
						["persona", "Personas"]
					].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": kind === id,
						className: "min-h-11 rounded-full px-3 text-sm " + (kind === id ? "bg-fg text-bg" : "bg-surface text-muted"),
						onClick: () => onKind(id),
						children: label
					}, id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-pressed": mature,
						className: "min-h-11 rounded-full px-3 text-sm " + (mature ? "bg-fg text-bg" : "bg-surface text-muted"),
						onClick: () => onMature(!mature),
						children: "Mature"
					}),
					tab === "mine" && total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 rounded-full px-3 text-sm text-muted",
						onClick: onClear,
						children: "Clear shelf"
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 divide-y divide-line border-y border-line",
				children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex w-full items-center gap-3 py-3 text-left",
					onClick: () => onOpen(item.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-11 shrink-0 place-items-center rounded-md bg-surface-2 font-display text-sm text-fg",
						children: monogram(item.name)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate font-medium text-fg",
								children: item.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 text-xs tracking-wide text-subtle uppercase",
								children: kindLabel(item.kind)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block truncate text-sm text-muted",
							children: item.blurb
						})]
					})]
				}) }, item.id))
			}),
			items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: tab === "mine" ? "Your shelf is empty. Drop a card or a bundle to start." : "Nothing matches."
			}) : null
		]
	});
}
function Detail({ item, packed, busy, onBack, onPack, onDownload }) {
	const lore = item.kind === "lorebook" ? item.book : item.kind === "card" ? item.card?.character_book : item.book;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rise",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "inline-flex min-h-11 items-center gap-2 text-sm text-muted",
				onClick: onBack,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
					className: "size-4",
					"aria-hidden": "true"
				}), "Back"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-xs tracking-widest text-subtle uppercase",
				children: [
					kindLabel(item.kind),
					item.nsfw ? " · Mature" : "",
					" · ",
					item.creator || "unsigned"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-3xl font-medium tracking-tight text-fg",
				children: item.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-base leading-normal text-muted",
				children: item.blurb
			}),
			item.tags.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-subtle",
				children: item.tags.join(" · ")
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: solid,
					disabled: busy,
					onClick: onDownload,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
						className: "size-4",
						"aria-hidden": "true"
					}), item.kind === "card" ? "Card PNG" : item.kind === "lorebook" ? "World JSON" : "Persona JSON"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: ghost,
					onClick: onPack,
					children: packed ? "Remove from pack" : "Add to pack"
				})]
			}),
			item.kind === "persona" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm leading-normal text-muted",
				children: "SillyTavern cannot import a persona from a file. Put this in a pack and import the bundle with the plugin."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 space-y-4 rounded-xl bg-surface p-4",
				children: [
					item.card ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Description",
							text: item.card.description
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Personality",
							text: item.card.personality
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Scenario",
							text: item.card.scenario
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "First message",
							text: item.card.first_mes
						})
					] }) : null,
					item.persona ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Description",
						text: item.persona.description
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Attached lorebook",
						text: item.persona.lorebookName || "None"
					})] }) : null,
					lore && lore.entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium text-fg",
						children: lore.name || "Lore"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-3",
						children: lore.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium text-fg",
								children: entry.comment
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-subtle",
								children: entry.keys.join(", ") || "Constant"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm leading-normal text-muted",
								children: entry.content
							})
						] }, entry.comment + entry.keys.join()))
					})] }) : null
				]
			})
		]
	});
}
function Field({ label, text }) {
	if (!text) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: "text-sm font-medium text-fg",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-1 text-sm leading-normal whitespace-pre-wrap text-muted",
		children: text
	})] });
}
function Adapters({ onNotice }) {
	const [raw, setRaw] = (0, import_react.useState)(JSON.stringify(SAMPLE_ARCHIVES, null, 2));
	const [found, setFound] = (0, import_react.useState)(null);
	const [origin, setOrigin] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setOrigin(window.location.origin);
	}, []);
	function convert() {
		try {
			const items = adaptPayload(JSON.parse(raw));
			setFound(items);
			onNotice(items.length ? "" : "Nothing in that JSON matched.");
		} catch {
			setFound([]);
			onNotice("That is not valid JSON.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rise space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl font-medium tracking-tight",
				children: "Adapters"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm leading-normal text-muted",
				children: "The plugin speaks one catalog. These three turn the places you already keep material into that catalog."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Adapter, {
				name: "Vault",
				text: "This site. Cards, lorebooks, and personas at a stable address the plugin can refresh.",
				meta: origin ? `${origin}/api/v1/catalog` : "Catalog address appears when the page is open."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Adapter, {
				name: "Archives",
				text: "Flat records from The Archives: name, description, personality, first message, tags, and character_book. A whole export with a cards list works too."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Adapter, {
				name: "Editor",
				text: "Character card V2 or V3 JSON, a PNG with a chara or ccv3 chunk, SillyTavern world info, and a persona sheet with a name and description."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-medium text-fg",
						children: "Try a payload"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghost,
								onClick: () => setRaw(JSON.stringify(SAMPLE_ARCHIVES, null, 2)),
								children: "Archives card"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghost,
								onClick: () => setRaw(JSON.stringify(SAMPLE_WORLD, null, 2)),
								children: "World info"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghost,
								onClick: () => setRaw(JSON.stringify(SAMPLE_EDITOR, null, 2)),
								children: "Editor card"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: raw,
						onChange: (event) => setRaw(event.target.value),
						spellCheck: false,
						className: "mt-3 min-h-48 w-full rounded-md border border-line bg-bg p-3 font-mono text-xs leading-normal text-fg outline-none",
						"aria-label": "JSON to convert"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${solid} mt-3`,
						onClick: convert,
						children: "Convert"
					}),
					found ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-4 space-y-2",
						children: [found.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-sm text-muted",
							children: "No items."
						}) : null, found.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-sm text-fg",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-subtle uppercase",
									children: kindLabel(item.kind)
								}),
								" ",
								item.name,
								item.card?.character_book ? ` · lore ${item.card.character_book.entries.length}` : "",
								item.book && item.kind === "lorebook" ? ` · ${item.book.entries.length} entries` : ""
							]
						}, item.id))]
					}) : null
				]
			})
		]
	});
}
function Adapter({ name, text, meta }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "border-t border-line pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-display text-xl font-medium",
				children: name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm leading-normal text-muted",
				children: text
			}),
			meta ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-mono text-xs break-all text-subtle",
				children: meta
			}) : null
		]
	});
}
function PluginPanel() {
	const [health, setHealth] = (0, import_react.useState)("");
	const [origin, setOrigin] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setOrigin(window.location.origin);
		fetch("/api/v1/health").then((res) => res.json()).then((body) => {
			const counts = body.counts;
			if (!counts) return;
			setHealth(`${counts.card} cards, ${counts.lorebook} lorebooks, ${counts.persona} personas live on this vault.`);
		}).catch(() => setHealth("The vault catalog is not answering."));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rise",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl font-medium tracking-tight",
				children: "SillyTavern plugin"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm leading-normal text-muted",
				children: "Install it once. After that, a refresh pulls the vault, or a bundle file brings a private shelf across — including personas, which SillyTavern will not take as a loose file."
			}),
			health ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-fg",
				children: health
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "mt-5 space-y-3 text-sm leading-normal text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-fg",
							children: "1. Download the extension."
						}),
						" Unzip it and keep the folder name",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "vellum-bridge"
						}),
						"."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-fg",
							children: "2. Move that folder"
						}),
						" into",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: "SillyTavern/public/scripts/extensions/third-party"
						}),
						". Restart SillyTavern."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-fg",
							children: "3. Open Extensions → Vellum Bridge."
						}),
						" Paste the vault address",
						origin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-xs break-all text-fg",
							children: origin
						})] }) : null,
						" ",
						"and, if you have one, your own Vellum or Archives address."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-fg",
						children: "4. Or skip the address."
					}), " Download a pack from this shelf and use Import bundle inside the plugin. One file writes cards, worlds, and personas."] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				className: `${solid} mt-5`,
				href: "/api/v1/plugin",
				download: "vellum-bridge.zip",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
					className: "size-4",
					"aria-hidden": "true"
				}), "Download plugin"]
			})
		]
	});
}
var SplitComponent = BridgeApp;
//#endregion
export { SplitComponent as component };
