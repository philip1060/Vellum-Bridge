import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, _ as createFileRoute, b as require_jsx_runtime, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, v as createRootRoute, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-1dLXugI8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-CKbD4Cyf.css";
var Route$6 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Vellum Bridge" },
			{
				name: "theme-color",
				content: "#12110f"
			},
			{
				name: "description",
				content: "Move character cards, lorebooks, and personas from Vellum into SillyTavern."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Outfit:wght@400;500;600&display=swap"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter = () => import("./routes-BWslpkBA.mjs");
var Route$5 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var seq = 0;
function slug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
}
function nextId(kind, name) {
	seq += 1;
	return `${kind}-${slug(name)}-${seq}`;
}
function asRecord(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value;
}
function asString(value, fallback = "") {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return fallback;
}
function parseMaybeJson(value) {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
	try {
		return JSON.parse(trimmed);
	} catch {
		return value;
	}
}
function asStringList(value) {
	const parsed = parseMaybeJson(value);
	if (Array.isArray(parsed)) return parsed.map((item) => asString(item).trim()).filter(Boolean);
	if (typeof parsed === "string") return parsed.split(",").map((part) => part.trim()).filter(Boolean);
	return [];
}
function blurbFrom(text) {
	const line = text.replace(/\s+/g, " ").trim();
	if (line.length <= 140) return line;
	return `${line.slice(0, 137).trimEnd()}…`;
}
function normalizeEntry(raw, index) {
	const entry = asRecord(raw);
	if (!entry) return null;
	const keys = asStringList(entry.keys ?? entry.key);
	const secondary = asStringList(entry.secondary_keys ?? entry.keysecondary);
	const content = asString(entry.content);
	if (!content && keys.length === 0) return null;
	const positionRaw = entry.position;
	const position = positionRaw === "after_char" || positionRaw === 1 || positionRaw === "1" ? "after_char" : "before_char";
	const enabled = entry.enabled !== false && entry.disable !== true && entry.disabled !== true;
	return {
		keys,
		secondary_keys: secondary,
		content,
		comment: asString(entry.comment || entry.name || keys[0] || `Entry ${index + 1}`),
		enabled,
		constant: Boolean(entry.constant),
		selective: entry.selective !== void 0 ? Boolean(entry.selective) : secondary.length > 0,
		insertion_order: Number(entry.insertion_order ?? entry.order ?? entry.priority ?? 100) || 0,
		position
	};
}
function normalizeBook(raw, fallbackName) {
	const book = asRecord(parseMaybeJson(raw));
	if (!book) return null;
	const rawEntries = parseMaybeJson(book.entries);
	const entries = (Array.isArray(rawEntries) ? rawEntries : rawEntries && typeof rawEntries === "object" ? Object.values(rawEntries) : []).map(normalizeEntry).filter((entry) => Boolean(entry));
	const name = asString(book.name) || fallbackName;
	if (!entries.length && !name) return null;
	return {
		name,
		description: asString(book.description),
		scan_depth: Number(book.scan_depth ?? 2) || 2,
		token_budget: Number(book.token_budget ?? 512) || 512,
		recursive_scanning: Boolean(book.recursive_scanning),
		entries
	};
}
function cardDataFrom(raw) {
	const data = asRecord(raw.data) ?? raw;
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
		character_book: book && book.entries.length ? book : null
	};
}
function isBundle(raw) {
	if (raw.spec === "vellum_bundle_v1") return true;
	return ("cards" in raw || "lorebooks" in raw || "personas" in raw) && !("data" in raw) && !("first_mes" in raw) && !("entries" in raw);
}
function isCard(raw) {
	if (asString(raw.spec).startsWith("chara_card")) return true;
	if (raw.rawSpec && asString(raw.rawSpec).startsWith("chara_card")) return true;
	const data = asRecord(raw.data) ?? raw;
	const hasIdentity = Boolean(asString(data.name));
	const hasCardField = "first_mes" in data || "personality" in data || "character_book" in data || "mes_example" in data || "scenario" in data;
	return hasIdentity && hasCardField && !isWorld(raw);
}
function isWorld(raw) {
	if (asString(raw.spec).startsWith("chara_card")) return false;
	if ("first_mes" in raw || "personality" in raw) return false;
	const entries = parseMaybeJson(raw.entries);
	if (Array.isArray(entries)) return entries.length > 0;
	if (entries && typeof entries === "object") return Object.keys(entries).length > 0;
	return false;
}
function isPersona(raw) {
	if (raw.kind === "persona") return true;
	const hasName = Boolean(asString(raw.name));
	const hasDescription = "description" in raw;
	const cardish = "first_mes" in raw || "personality" in raw || "character_book" in raw || "entries" in raw;
	return hasName && hasDescription && !cardish;
}
function itemBase(kind, name, source, tags, blurb, creator, nsfw) {
	return {
		id: nextId(kind, name),
		kind,
		name,
		creator,
		tags,
		blurb,
		nsfw,
		source
	};
}
function cardItem(raw, source) {
	const card = cardDataFrom(raw);
	const tags = card.tags;
	const nsfw = tags.some((tag) => /^(nsfw|nsfl|mature)$/i.test(tag)) || Boolean(raw.nsfw);
	return {
		...itemBase("card", card.name, source, tags, blurbFrom(card.description || card.personality || card.scenario), card.creator, nsfw),
		card
	};
}
function bookItem(raw, source, fallbackName) {
	const book = normalizeBook(raw, fallbackName);
	if (!book) return null;
	const record = asRecord(parseMaybeJson(raw));
	const tags = asStringList(record?.tags);
	return {
		...itemBase("lorebook", book.name || fallbackName, source, tags, blurbFrom(book.description || book.entries[0]?.content || ""), asString(record?.creator), false),
		book
	};
}
function personaItem(raw, source) {
	const persona = {
		name: asString(raw.name, "Persona"),
		title: asString(raw.title || raw.name),
		description: asString(raw.description),
		lorebookName: asString(raw.lorebookName || raw.lorebook)
	};
	const book = normalizeBook(raw.book ?? raw.lorebook_data ?? raw.character_book, persona.lorebookName);
	return {
		...itemBase("persona", persona.name, source === "vault" ? "persona" : source, asStringList(raw.tags), blurbFrom(persona.description), asString(raw.creator), false),
		persona,
		book: book && book.entries.length ? book : void 0
	};
}
function adaptPayload(input, source = "bundle") {
	if (Array.isArray(input)) return input.flatMap((entry) => adaptPayload(entry, source));
	const raw = asRecord(input);
	if (!raw) return [];
	if (raw.kind === "card" && asRecord(raw.card)) return [cardItem(asRecord(raw.card), source)];
	if (raw.kind === "lorebook" && raw.book) {
		const item = bookItem(raw.book, source, asString(raw.name, "Lorebook"));
		return item ? [item] : [];
	}
	if (raw.kind === "persona") return [personaItem(asRecord(raw.persona) ?? raw, source)];
	if (isBundle(raw)) {
		const cards = Array.isArray(raw.cards) ? raw.cards.flatMap((entry) => adaptPayload(entry, "bundle")) : [];
		const books = Array.isArray(raw.lorebooks) ? raw.lorebooks.flatMap((entry) => {
			const item = bookItem(entry, "bundle", "Lorebook");
			return item ? [item] : [];
		}) : [];
		const personas = Array.isArray(raw.personas) ? raw.personas.flatMap((entry) => adaptPayload(entry, "persona")) : [];
		return [
			...cards,
			...books,
			...personas
		];
	}
	if (isCard(raw)) return [cardItem(raw, source)];
	if (isWorld(raw)) {
		const item = bookItem(raw, source, asString(raw.name, "Lorebook"));
		return item ? [item] : [];
	}
	if (isPersona(raw)) return [personaItem(raw, source)];
	return [];
}
var SAMPLE_ARCHIVES = {
	name: "June Pell",
	creator: "the-archives",
	description: "Keeps an inn at the end of a road that mapmakers keep forgetting. Remembers every order. Forgets every name on purpose.",
	personality: "Dry, hospitable, impossible to hurry. Speaks as if the kettle is the one making the decisions.",
	scenario: "Rain, late. The sign over the door is only a painted bowl. {{user}} is the only guest tonight.",
	first_mes: "Bowl's hot. Don't tell me your name unless you want it written in the book, and the book has opinions.",
	tags: ["scenario:inn", "original"],
	character_book: {
		name: "Pell Inn",
		entries: [{
			keys: ["the book", "guest book"],
			content: "The guest book writes back. Names left in it can be called from the road on storm nights.",
			insertion_order: 100
		}]
	}
};
var SAMPLE_WORLD = {
	name: "Lampward ordinances",
	description: "What the night city actually enforces.",
	entries: { "0": {
		uid: 0,
		key: ["lampward", "the ward"],
		comment: "Lampward",
		content: "Lampward is the district where the gaslamps are a legal requirement, not a courtesy. Unlit streets are treated as closed.",
		order: 100,
		disable: false,
		constant: false
	} }
};
var SAMPLE_EDITOR = {
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
		character_book: null
	}
};
/** Store-only ZIP (method 0). Enough for an extension folder and an import pack. */
var CRC = (() => {
	const t = /* @__PURE__ */ new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();
function crc32(buf) {
	let c = 4294967295;
	for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ c >>> 8;
	return (c ^ 4294967295) >>> 0;
}
function dosStamp(date) {
	const year = Math.max(date.getFullYear(), 1980);
	return {
		time: date.getHours() << 11 | date.getMinutes() << 5 | date.getSeconds() >> 1,
		date: year - 1980 << 9 | date.getMonth() + 1 << 5 | date.getDate()
	};
}
function zipStore(files, now = /* @__PURE__ */ new Date()) {
	const stamp = dosStamp(now);
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const file of files) {
		const name = new TextEncoder().encode(file.name);
		const crc = crc32(file.data);
		const local = new Uint8Array(30 + name.length + file.data.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 67324752, true);
		lv.setUint16(4, 20, true);
		lv.setUint16(6, 2048, true);
		lv.setUint16(8, 0, true);
		lv.setUint16(10, stamp.time, true);
		lv.setUint16(12, stamp.date, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, file.data.length, true);
		lv.setUint32(22, file.data.length, true);
		lv.setUint16(26, name.length, true);
		lv.setUint16(28, 0, true);
		local.set(name, 30);
		local.set(file.data, 30 + name.length);
		locals.push(local);
		const central = new Uint8Array(46 + name.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 33639248, true);
		cv.setUint16(4, 788, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(8, 2048, true);
		cv.setUint16(10, 0, true);
		cv.setUint16(12, stamp.time, true);
		cv.setUint16(14, stamp.date, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, file.data.length, true);
		cv.setUint32(24, file.data.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint16(30, 0, true);
		cv.setUint16(32, 0, true);
		cv.setUint16(34, 0, true);
		cv.setUint16(36, 0, true);
		cv.setUint32(38, 0, true);
		cv.setUint32(42, offset, true);
		central.set(name, 46);
		centrals.push(central);
		offset += local.length;
	}
	const cdSize = centrals.reduce((n, c) => n + c.length, 0);
	const eocd = /* @__PURE__ */ new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 101010256, true);
	ev.setUint16(4, 0, true);
	ev.setUint16(6, 0, true);
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, cdSize, true);
	ev.setUint32(16, offset, true);
	ev.setUint16(20, 0, true);
	const total = offset + cdSize + eocd.length;
	const out = new Uint8Array(total);
	let pos = 0;
	for (const part of locals) {
		out.set(part, pos);
		pos += part.length;
	}
	for (const part of centrals) {
		out.set(part, pos);
		pos += part.length;
	}
	out.set(eocd, pos);
	return out;
}
function asArrayBuffer(bytes) {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function textFile(name, text) {
	return {
		name,
		data: new TextEncoder().encode(text)
	};
}
var CORS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET, POST, OPTIONS",
	"access-control-allow-headers": "content-type, authorization",
	"access-control-max-age": "86400"
};
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...CORS
		}
	});
}
function empty(status = 204) {
	return new Response(null, {
		status,
		headers: CORS
	});
}
function bytes(body, contentType, filename) {
	return new Response(new Blob([asArrayBuffer(body)]), { headers: {
		"content-type": contentType,
		"content-disposition": `attachment; filename="${filename}"`,
		...CORS
	} });
}
function toCharacterCard(card, id) {
	const data = {
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
		extensions: { vellum: {
			id,
			bridge: "vellum-bridge"
		} }
	};
	if (card.character_book && card.character_book.entries.length) data.character_book = toEmbeddedBook(card.character_book);
	return {
		spec: "chara_card_v3",
		spec_version: "3.0",
		data
	};
}
function toV2Card(v3) {
	return {
		spec: "chara_card_v2",
		spec_version: "2.0",
		data: v3.data
	};
}
function toEmbeddedBook(book) {
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
			extensions: {}
		}))
	};
}
function toWorldInfo(book) {
	const entries = {};
	book.entries.forEach((entry, index) => {
		entries[String(index)] = worldEntry(entry, index);
	});
	return { entries };
}
function worldEntry(entry, index) {
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
		extensions: {}
	};
}
function toSillyTavern(item) {
	if (item.kind === "card" && item.card) {
		const book = item.card.character_book;
		return {
			id: item.id,
			kind: "card",
			name: item.name,
			card: toCharacterCard(item.card, item.id),
			world: book && book.entries.length ? toWorldInfo(book) : null,
			worldName: book && book.entries.length ? book.name || `${item.name} lore` : null,
			persona: null
		};
	}
	if (item.kind === "lorebook" && item.book) return {
		id: item.id,
		kind: "lorebook",
		name: item.name,
		card: null,
		world: toWorldInfo(item.book),
		worldName: item.book.name || item.name,
		persona: null
	};
	const persona = item.persona ?? {
		name: item.name,
		title: item.name,
		description: item.blurb,
		lorebookName: ""
	};
	const book = item.book;
	return {
		id: item.id,
		kind: "persona",
		name: item.name,
		card: null,
		world: book && book.entries.length ? toWorldInfo(book) : null,
		worldName: persona.lorebookName || (book ? book.name : null),
		persona
	};
}
function safeFileName(name) {
	return (name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "import").slice(0, 80);
}
var Route$4 = createFileRoute("/api/v1/adapt")({ server: { handlers: {
	OPTIONS: () => empty(),
	POST: async ({ request }) => {
		let body;
		try {
			body = await request.json();
		} catch {
			return json({ error: "Send JSON from the vault, the archives, or the card editor." }, 400);
		}
		const source = new URL(request.url).searchParams.get("source");
		const items = adaptPayload(body, source === "archives" || source === "editor" || source === "vault" ? source : "bundle");
		if (!items.length) return json({ error: "Nothing in that file matched a card, lorebook, persona, or Vellum bundle." }, 422);
		return json({
			protocol: "vellum-catalog-v1",
			items,
			sillytavern: items.map(toSillyTavern)
		});
	}
} } });
function book(name, description, entries, extra = {}) {
	return {
		name,
		description,
		scan_depth: extra.scan_depth ?? 3,
		token_budget: extra.token_budget ?? 512,
		recursive_scanning: extra.recursive_scanning ?? false,
		entries
	};
}
function entry(keys, content, comment, extra = {}) {
	return {
		keys,
		secondary_keys: extra.secondary_keys ?? [],
		content,
		comment,
		enabled: extra.enabled ?? true,
		constant: extra.constant ?? false,
		selective: extra.selective ?? false,
		insertion_order: extra.insertion_order ?? 100,
		position: extra.position ?? "before_char"
	};
}
function card(data, id, blurb, nsfw = false) {
	return {
		id,
		kind: "card",
		name: data.name,
		creator: data.creator,
		tags: data.tags,
		blurb,
		nsfw,
		source: "vault",
		card: data
	};
}
var drowned = book("The Drowned Stacks", "A library that flooded and kept taking new books.", [
	entry(["drowned stacks", "the stacks"], "The Drowned Stacks are a library under a city that sank on a clear afternoon. The shelves are dry. The aisles are not. Catalog numbers are still valid if you can hold your breath between ranges.", "The Stacks", { insertion_order: 200 }),
	entry(["the catalog", "call number"], "Call numbers here name a memory, not a shelf. Reading a number aloud pulls the book to the surface, along with whoever last checked it out.", "Call numbers"),
	entry(["ink tide"], "Once a month the lower ranges flood with ink. Anything written that night is filed whether or not the author meant to donate it.", "Ink tide", { insertion_order: 80 })
]);
var lampward = book("Lampward", "Night law in the gaslit district.", [
	entry(["lampward"], "Lampward is the district where a lit lamp is a legal requirement. An unlit street is closed. Couriers who douse a lamp owe the city a night's wages and a written apology to the wick.", "The ward", { insertion_order: 200 }),
	entry(["gaslamp", "the lamps"], "The lamps are maintained by the Wick Office. They burn a pressed oil that smells faintly of orange peel. Extinguishing one in front of a witness is a civil offense.", "Lamps"),
	entry(["night pass"], "A night pass is a brass slip punched by the Wick Office. Without it, a courier may still walk Lampward, but may not be paid for anything carried after the second bell.", "Night pass", {
		secondary_keys: ["courier", "pay"],
		selective: true
	})
]);
var pell = book("House rules of the Pell", "What the inn enforces without posting it.", [entry(["guest book", "the book"], "The guest book at the Pell writes back. A name entered in it can be called in from the road during a storm. June Pell does not explain this. She just leaves the book closed unless asked.", "Guest book", {
	constant: true,
	insertion_order: 200
}), entry(["the bowl", "painted bowl"], "The sign is a painted bowl because the inn has no name June is willing to put on a board. Regulars call it the Pell anyway. She pretends not to hear it.", "The sign")]);
var VAULT = [
	card({
		name: "Maris Quell",
		nickname: "Maris",
		description: "Archivist of the Drowned Stacks. Knee-deep in aisle water more often than not, hair pinned with a dry pencil, coat hem permanently tea-colored. She believes a lost book is a kind of debt, and she collects.",
		personality: "Exacting, quiet, unexpectedly funny when a catalog card is wrong. Protective of borrowers. Impatient with people who treat the stacks as a mood.",
		scenario: "{{user}} has a call number written on the inside of their wrist and no memory of who put it there. Maris is on a dry landing, reshelving a book that keeps dripping.",
		first_mes: "Don't shake it off. The number's still legible, which means the book is still willing. Give me your wrist and stand where the floor is only damp. If you step into the aisle before I say, you come back as a footnote.",
		mes_example: "<START>\n{{user}}: I don't remember asking for a book.\n{{char}}: Nobody does. The catalog is rude that way. Hold still — this one cites you in the margin, and I would like to know why before it cites you as missing.\n<START>",
		creator_notes: "Central vault original. Embedded lore covers the stacks; the standalone book is the fuller copy.",
		system_prompt: "Write Maris as precise and dry. Keep the library's rules consistent. Do not modernize the stacks into a metaphor for the internet.",
		post_history_instructions: "If a call number is spoken aloud, the corresponding book should arrive wet, closed, and heavier than it looks.",
		alternate_greetings: ["You're early. The ink tide isn't for another hour, and I am not fishing strangers out of it tonight. Sit on the landing."],
		tags: [
			"original",
			"library",
			"fantasy"
		],
		creator: "vellum vault",
		character_version: "1.2",
		character_book: drowned
	}, "vault-maris-quell", "Archivist of a library that flooded and kept lending."),
	card({
		name: "Sable Venn",
		nickname: "Sable",
		description: "Night courier in Lampward. Carries sealed slips, spare wicks, and other people's bad timing. A brass night pass hangs inside the coat, punched so many times the edge is soft.",
		personality: "Economical with words, loyal to the address on the slip, suspicious of anyone who wants the route instead of the delivery. Kind in practical ways: an extra lamp, a dry step, no questions.",
		scenario: "Second bell. {{user}} is waiting under a lamp that is one gust away from going out. Sable has a delivery with their name and no sender.",
		first_mes: "Venn. Night pass is good, lamp is not. If it dies before I hand this over, the ward calls the street closed and I walk your letter back to a desk that doesn't want it. Hold the glass. Don't look at the seal.",
		mes_example: "",
		creator_notes: "Pairs with the Lampward lorebook.",
		system_prompt: "Keep Sable terse. Lampward law is real, not flavor. Deliveries are specific objects, never vague 'a package of secrets' unless the slip says so.",
		post_history_instructions: "",
		alternate_greetings: [],
		tags: [
			"original",
			"city",
			"courier"
		],
		creator: "vellum vault",
		character_version: "1.0",
		character_book: null
	}, "vault-sable-venn", "Courier who only works streets the lamps are still willing to light."),
	card({
		name: "Ivo Hart",
		nickname: "Ivo",
		description: "Retired duelist who teaches fencing to people who will not need it. Two fingers missing on the left hand. He holds the foil in the right and corrects your feet with the left anyway, which is worse.",
		personality: "Blunt, theatrical only when a student is being precious. Refuses to discuss the duel. Secretly proud when someone gets bored enough to improve.",
		scenario: "A rented hall with a bad floor. {{user}} booked a lesson and arrived in shoes that will scar the wood.",
		first_mes: "Shoes off or get out. I don't care which story you wanted. Feet, then hands, then the part where you stop apologizing to the air. The missing fingers are not a conversation. En garde means you are late.",
		mes_example: "",
		creator_notes: "",
		system_prompt: "Ivo does not recount the duel. If pressed, he changes the subject to footwork. Keep injuries practical, not gothic.",
		post_history_instructions: "",
		alternate_greetings: [],
		tags: ["original", "instructor"],
		creator: "vellum vault",
		character_version: "1.0",
		character_book: null
	}, "vault-ivo-hart", "Teaches the lunge, not the legend. Do not ask about the hand."),
	card({
		name: "June Pell",
		nickname: "June",
		description: "Keeps an inn at the end of a road mapmakers keep forgetting. Remembers every order. Forgets every name on purpose, unless it goes in the book.",
		personality: "Dry, hospitable, impossible to hurry. The kettle is treated as a colleague.",
		scenario: "Rain, late. {{user}} is the only guest. The sign over the door is a painted bowl.",
		first_mes: "Bowl's hot. Bread's yesterday's, which is the honest kind. Don't tell me your name unless you want it written down. The book has opinions, and I am off duty from opinions.",
		mes_example: "",
		creator_notes: "Standalone lorebook has the house rules. A short copy is also embedded.",
		system_prompt: "June never explains the guest book outright on the first night. She will if {{user}} asks twice.",
		post_history_instructions: "",
		alternate_greetings: ["You can sleep in the chair by the fire. The rooms remember the last guest louder than I'd like."],
		tags: ["original", "inn"],
		creator: "vellum vault",
		character_version: "1.1",
		character_book: {
			...pell,
			entries: pell.entries.map((item) => ({
				...item,
				constant: false
			}))
		}
	}, "vault-june-pell", "Innkeeper who will feed you and will not keep your name unless you insist."),
	card({
		name: "Lark",
		nickname: "",
		description: "Tends bar in a room under Lampward where the lamps are optional and the tabs are not. Flirts the way other people make change: automatically, and with an eye on what you can actually afford.",
		personality: "Warm, nosy, hard to scandalize. Drops the charm the moment someone is unkind to the staff, which is mostly just Lark.",
		scenario: "After the second bell. {{user}} has taken the corner stool. The rest of the room is pretending not to listen.",
		first_mes: "You get one drink on the house if you tell me a true thing, and a second if the true thing is boring. Exciting secrets pay full price. What'll it be.",
		mes_example: "",
		creator_notes: "Mature tone, not explicit. Included so the vault filter has something to hide.",
		system_prompt: "Keep Lark flirtatious and verbal. Fade to black on anything past a kiss. No graphic sexual content.",
		post_history_instructions: "",
		alternate_greetings: [],
		tags: [
			"original",
			"mature",
			"nsfw"
		],
		creator: "vellum vault",
		character_version: "1.0",
		character_book: null
	}, "vault-lark", "Bartender under the ward. Charm is itemized. So is the tab.", true),
	{
		id: "vault-drowned-stacks",
		kind: "lorebook",
		name: "The Drowned Stacks",
		creator: "vellum vault",
		tags: ["world", "library"],
		blurb: "Rules for the flooded library: call numbers, the ink tide, what the aisles keep.",
		nsfw: false,
		source: "vault",
		book: drowned
	},
	{
		id: "vault-lampward",
		kind: "lorebook",
		name: "Lampward",
		creator: "vellum vault",
		tags: ["world", "city"],
		blurb: "Night law, lamps, and the brass pass the couriers actually get paid with.",
		nsfw: false,
		source: "vault",
		book: lampward
	},
	{
		id: "vault-pell-rules",
		kind: "lorebook",
		name: "House rules of the Pell",
		creator: "vellum vault",
		tags: ["world", "inn"],
		blurb: "The guest book writes back. The sign is only a bowl. June will not post either fact.",
		nsfw: false,
		source: "vault",
		book: pell
	},
	{
		id: "vault-persona-patron",
		kind: "persona",
		name: "The Quiet Patron",
		creator: "vellum vault",
		tags: ["persona", "library"],
		blurb: "You are a regular at the stacks. You speak softly and you return books on time.",
		nsfw: false,
		source: "vault",
		persona: {
			name: "The Quiet Patron",
			title: "Patron",
			description: "{{user}} is a long-standing borrower at the Drowned Stacks. Soft-spoken, punctual, unwilling to raise their voice in the aisles. They know the landing is the safe place to stand and they do not show off the call numbers they remember.",
			lorebookName: "The Drowned Stacks"
		},
		book: drowned
	},
	{
		id: "vault-persona-rook",
		kind: "persona",
		name: "Rook",
		creator: "vellum vault",
		tags: ["persona", "city"],
		blurb: "A street name for Lampward. You know which lamps are about to fail.",
		nsfw: false,
		source: "vault",
		persona: {
			name: "Rook",
			title: "Rook",
			description: "{{user}} goes by Rook in Lampward. Not a courier — a person who walks the ward often enough to know which lamps gutter. Practical coat, no night pass, pays in exact coin. Does not give a legal name.",
			lorebookName: "Lampward"
		},
		book: lampward
	},
	{
		id: "vault-persona-guest",
		kind: "persona",
		name: "The Unlisted Guest",
		creator: "vellum vault",
		tags: ["persona", "inn"],
		blurb: "You stay at the Pell and you have never put your name in the book.",
		nsfw: false,
		source: "vault",
		persona: {
			name: "The Unlisted Guest",
			title: "Guest",
			description: "{{user}} is a repeating guest at June Pell's inn who has never written their name in the book. They take the chair by the fire when the rooms feel loud. They tip in bread money and leave before the road remembers them.",
			lorebookName: "House rules of the Pell"
		},
		book: pell
	}
];
function listVault() {
	return VAULT;
}
function getVaultItem(id) {
	return VAULT.find((item) => item.id === id);
}
function summarize(item) {
	return {
		id: item.id,
		kind: item.kind,
		name: item.name,
		creator: item.creator,
		tags: item.tags,
		blurb: item.blurb,
		nsfw: item.nsfw,
		source: item.source,
		loreCount: item.kind === "lorebook" ? item.book?.entries.length ?? 0 : item.kind === "card" ? item.card?.character_book?.entries.length ?? 0 : item.book?.entries.length ?? 0
	};
}
var Route$3 = createFileRoute("/api/v1/catalog")({ server: { handlers: {
	OPTIONS: () => empty(),
	GET: ({ request }) => {
		const url = new URL(request.url);
		const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
		const kind = url.searchParams.get("kind") ?? "all";
		const nsfw = url.searchParams.get("nsfw") ?? "hide";
		return json({
			protocol: "vellum-catalog-v1",
			source: "vault",
			items: listVault().filter((item) => {
				if (kind !== "all" && item.kind !== kind) return false;
				if (nsfw === "hide" && item.nsfw) return false;
				if (nsfw === "only" && !item.nsfw) return false;
				if (!q) return true;
				return [
					item.name,
					item.creator,
					item.blurb,
					...item.tags
				].join(" ").toLowerCase().includes(q);
			}).map(summarize)
		});
	}
} } });
var Route$2 = createFileRoute("/api/v1/health")({ server: { handlers: {
	OPTIONS: () => empty(),
	GET: () => {
		const items = listVault();
		return json({
			name: "Vellum Bridge",
			protocol: "vellum-catalog-v1",
			adapters: [
				"vault",
				"archives",
				"editor"
			],
			counts: {
				card: items.filter((item) => item.kind === "card").length,
				lorebook: items.filter((item) => item.kind === "lorebook").length,
				persona: items.filter((item) => item.kind === "persona").length
			}
		});
	}
} } });
var vellum_bridge_default = "// Vellum Bridge — pull cards, lorebooks, and personas into SillyTavern.\nconst MODULE = \"vellum_bridge\";\n\nconst CRC_TABLE = (() => {\n    const table = new Uint32Array(256);\n    for (let n = 0; n < 256; n++) {\n        let c = n;\n        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;\n        table[n] = c;\n    }\n    return table;\n})();\n\nfunction crc32(buf) {\n    let c = 0xffffffff;\n    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);\n    return (c ^ 0xffffffff) >>> 0;\n}\n\nfunction injectTextChunk(pngBuffer, keyword, text) {\n    const bytes = new Uint8Array(pngBuffer);\n    const view = new DataView(pngBuffer);\n    const kept = [];\n    let offset = 8;\n    while (offset + 12 <= bytes.length) {\n        const length = view.getUint32(offset, false);\n        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);\n        const start = offset + 8;\n        const end = start + length;\n        if (end + 4 > bytes.length) break;\n        const data = bytes.subarray(start, end);\n        if (type === \"tEXt\") {\n            const nul = data.indexOf(0);\n            if (nul !== -1) {\n                const kw = new TextDecoder().decode(data.subarray(0, nul));\n                if (kw.toLowerCase() === keyword.toLowerCase()) {\n                    offset = end + 4;\n                    continue;\n                }\n            }\n        }\n        if (type === \"IEND\") break;\n        kept.push({ type, data: new Uint8Array(data) });\n        offset = end + 4;\n    }\n    const keyBytes = new TextEncoder().encode(keyword);\n    const textBytes = new TextEncoder().encode(text);\n    const chunk = new Uint8Array(keyBytes.length + 1 + textBytes.length);\n    chunk.set(keyBytes, 0);\n    chunk[keyBytes.length] = 0;\n    chunk.set(textBytes, keyBytes.length + 1);\n    let total = 8 + 12 + chunk.length + 12;\n    for (const part of kept) total += 12 + part.data.length;\n    const out = new Uint8Array(total);\n    out.set(bytes.subarray(0, 8), 0);\n    let pos = 0;\n    out.set(bytes.subarray(0, 8), 0);\n    pos = 8;\n    const write = (type, data) => {\n        const typeBytes = new TextEncoder().encode(type);\n        const viewOut = new DataView(out.buffer);\n        viewOut.setUint32(pos, data.length, false);\n        pos += 4;\n        out.set(typeBytes, pos);\n        pos += 4;\n        out.set(data, pos);\n        pos += data.length;\n        const crcBuf = new Uint8Array(4 + data.length);\n        crcBuf.set(typeBytes, 0);\n        crcBuf.set(data, 4);\n        viewOut.setUint32(pos, crc32(crcBuf), false);\n        pos += 4;\n    };\n    for (const part of kept) write(part.type, part.data);\n    write(\"tEXt\", chunk);\n    write(\"IEND\", new Uint8Array(0));\n    return out.buffer;\n}\n\nfunction utf8ToBase64(text) {\n    const bytes = new TextEncoder().encode(text);\n    const parts = [];\n    for (let i = 0; i < bytes.length; i += 0x8000) {\n        const slice = bytes.subarray(i, i + 0x8000);\n        let bin = \"\";\n        for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);\n        parts.push(bin);\n    }\n    return btoa(parts.join(\"\"));\n}\n\nfunction safeFileName(name) {\n    const cleaned = String(name || \"import\").replace(/[<>:\"/\\\\|?*\\u0000-\\u001f]/g, \" \").replace(/\\s+/g, \" \").trim();\n    return (cleaned || \"import\").slice(0, 80);\n}\n\nfunction asList(value) {\n    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);\n    if (typeof value === \"string\") return value.split(\",\").map((part) => part.trim()).filter(Boolean);\n    return [];\n}\n\nfunction normalizeEntry(raw, index) {\n    if (!raw || typeof raw !== \"object\") return null;\n    const keys = asList(raw.keys ?? raw.key);\n    const secondary = asList(raw.secondary_keys ?? raw.keysecondary);\n    const content = String(raw.content || \"\");\n    if (!content && !keys.length) return null;\n    const position = raw.position === \"after_char\" || raw.position === 1 ? \"after_char\" : \"before_char\";\n    return {\n        keys,\n        secondary_keys: secondary,\n        content,\n        comment: String(raw.comment || raw.name || keys[0] || `Entry ${index + 1}`),\n        enabled: raw.enabled !== false && raw.disable !== true,\n        constant: Boolean(raw.constant),\n        selective: raw.selective !== undefined ? Boolean(raw.selective) : secondary.length > 0,\n        insertion_order: Number(raw.insertion_order ?? raw.order ?? 100) || 0,\n        position,\n    };\n}\n\nfunction normalizeBook(raw, fallbackName) {\n    if (!raw || typeof raw !== \"object\") return null;\n    const entriesRaw = raw.entries;\n    const list = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw && typeof entriesRaw === \"object\" ? Object.values(entriesRaw) : [];\n    const entries = list.map(normalizeEntry).filter(Boolean);\n    if (!entries.length && !raw.name && !fallbackName) return null;\n    return {\n        name: String(raw.name || fallbackName || \"Lorebook\"),\n        description: String(raw.description || \"\"),\n        scan_depth: Number(raw.scan_depth ?? 2) || 2,\n        token_budget: Number(raw.token_budget ?? 512) || 512,\n        recursive_scanning: Boolean(raw.recursive_scanning),\n        entries,\n    };\n}\n\nfunction cardFrom(raw) {\n    const data = raw.data && typeof raw.data === \"object\" ? raw.data : raw;\n    const book = normalizeBook(data.character_book, `${data.name || \"Character\"} lore`);\n    return {\n        name: String(data.name || \"Untitled\"),\n        nickname: String(data.nickname || \"\"),\n        description: String(data.description || \"\"),\n        personality: String(data.personality || \"\"),\n        scenario: String(data.scenario || \"\"),\n        first_mes: String(data.first_mes || \"\"),\n        mes_example: String(data.mes_example || \"\"),\n        creator_notes: String(data.creator_notes || \"\"),\n        system_prompt: String(data.system_prompt || \"\"),\n        post_history_instructions: String(data.post_history_instructions || \"\"),\n        alternate_greetings: asList(data.alternate_greetings),\n        tags: asList(data.tags),\n        creator: String(data.creator || \"\"),\n        character_version: String(data.character_version || \"1.0\"),\n        character_book: book && book.entries.length ? book : null,\n    };\n}\n\nlet localSeq = 0;\n\nfunction adaptPayload(input) {\n    if (Array.isArray(input)) return input.flatMap((entry) => adaptPayload(entry));\n    if (!input || typeof input !== \"object\") return [];\n    if (input.spec === \"vellum_bundle_v1\" || (input.cards || input.lorebooks || input.personas) && !input.data && !input.first_mes && !input.entries) {\n        return [\n            ...(Array.isArray(input.cards) ? input.cards.flatMap((entry) => adaptPayload(entry)) : []),\n            ...(Array.isArray(input.lorebooks) ? input.lorebooks.flatMap((entry) => adaptPayload(entry)) : []),\n            ...(Array.isArray(input.personas) ? input.personas.flatMap((entry) => adaptPayload({ ...entry, kind: \"persona\" })) : []),\n        ];\n    }\n    const spec = String(input.spec || \"\");\n    const data = input.data && typeof input.data === \"object\" ? input.data : input;\n    const cardish = spec.startsWith(\"chara_card\") || \"first_mes\" in data || \"personality\" in data || \"character_book\" in data;\n    const entries = input.entries ?? data.entries;\n    const worldish = !spec.startsWith(\"chara_card\") && !(\"first_mes\" in input) && !(\"personality\" in input) && entries && typeof entries === \"object\";\n    if (input.kind === \"card\" && input.card) return adaptPayload(input.card);\n    if (input.kind === \"lorebook\" && input.book) return adaptPayload(input.book);\n    if (input.kind === \"persona\" || (input.name && input.description && !cardish && !worldish)) {\n        localSeq += 1;\n        const book = normalizeBook(input.book || input.character_book, input.lorebookName || input.lorebook || \"\");\n        return [{\n            id: `persona-${localSeq}`,\n            kind: \"persona\",\n            name: String((input.persona && input.persona.name) || input.name || \"Persona\"),\n            blurb: \"\",\n            tags: [],\n            persona: {\n                name: String((input.persona && input.persona.name) || input.name || \"Persona\"),\n                title: String((input.persona && input.persona.title) || input.title || input.name || \"\"),\n                description: String((input.persona && input.persona.description) || input.description || \"\"),\n                lorebookName: String((input.persona && input.persona.lorebookName) || input.lorebookName || input.lorebook || \"\"),\n            },\n            book: book && book.entries.length ? book : null,\n        }];\n    }\n    if (worldish && !cardish) {\n        const book = normalizeBook(input, input.name || \"Lorebook\");\n        if (!book) return [];\n        localSeq += 1;\n        return [{ id: `lorebook-${localSeq}`, kind: \"lorebook\", name: book.name, blurb: book.description, tags: [], book }];\n    }\n    if (cardish && (data.name || input.name)) {\n        const card = cardFrom(input);\n        localSeq += 1;\n        return [{ id: `card-${localSeq}`, kind: \"card\", name: card.name, blurb: \"\", tags: card.tags, card }];\n    }\n    return [];\n}\n\nfunction worldEntry(entry, index) {\n    return {\n        uid: index,\n        key: entry.keys,\n        keysecondary: entry.secondary_keys,\n        comment: entry.comment,\n        content: entry.content,\n        constant: entry.constant,\n        selective: entry.selective,\n        order: entry.insertion_order,\n        position: entry.position === \"after_char\" ? 1 : 0,\n        disable: !entry.enabled,\n        displayIndex: index,\n        addMemo: true,\n        group: \"\",\n        groupOverride: false,\n        groupWeight: 100,\n        sticky: 0,\n        cooldown: 0,\n        delay: 0,\n        probability: 100,\n        depth: 4,\n        useProbability: true,\n        role: null,\n        vectorized: false,\n        excludeRecursion: false,\n        preventRecursion: false,\n        delayUntilRecursion: false,\n        scanDepth: null,\n        caseSensitive: null,\n        matchWholeWords: null,\n        useGroupScoring: null,\n        automationId: \"\",\n        extensions: {},\n    };\n}\n\nfunction toWorld(book) {\n    const entries = {};\n    book.entries.forEach((entry, index) => {\n        entries[String(index)] = worldEntry(entry, index);\n    });\n    return { entries };\n}\n\nfunction toCard(card, id) {\n    const data = {\n        name: card.name,\n        nickname: card.nickname || \"\",\n        description: card.description,\n        personality: card.personality,\n        scenario: card.scenario,\n        first_mes: card.first_mes,\n        mes_example: card.mes_example,\n        creator_notes: card.creator_notes,\n        system_prompt: card.system_prompt,\n        post_history_instructions: card.post_history_instructions,\n        alternate_greetings: card.alternate_greetings || [],\n        tags: card.tags || [],\n        creator: card.creator,\n        character_version: card.character_version || \"1.0\",\n        extensions: { vellum: { id, bridge: \"vellum-bridge\" } },\n    };\n    if (card.character_book && card.character_book.entries && card.character_book.entries.length) {\n        data.character_book = {\n            name: card.character_book.name,\n            description: card.character_book.description || \"\",\n            scan_depth: card.character_book.scan_depth ?? 2,\n            token_budget: card.character_book.token_budget ?? 512,\n            recursive_scanning: Boolean(card.character_book.recursive_scanning),\n            extensions: {},\n            entries: card.character_book.entries.map((entry, index) => ({\n                id: index,\n                keys: entry.keys,\n                secondary_keys: entry.secondary_keys || [],\n                content: entry.content,\n                comment: entry.comment || \"\",\n                enabled: entry.enabled !== false,\n                constant: Boolean(entry.constant),\n                selective: Boolean(entry.selective),\n                insertion_order: entry.insertion_order ?? 100,\n                position: entry.position === \"after_char\" ? \"after_char\" : \"before_char\",\n                extensions: {},\n            })),\n        };\n    }\n    return { spec: \"chara_card_v3\", spec_version: \"3.0\", data };\n}\n\nfunction toSillyTavern(item) {\n    if (item.kind === \"card\" && item.card) {\n        const book = item.card.character_book;\n        return {\n            id: item.id,\n            kind: \"card\",\n            name: item.name,\n            card: toCard(item.card, item.id),\n            world: book && book.entries.length ? toWorld(book) : null,\n            worldName: book && book.entries.length ? (book.name || `${item.name} lore`) : null,\n            persona: null,\n        };\n    }\n    if (item.kind === \"lorebook\" && item.book) {\n        return {\n            id: item.id,\n            kind: \"lorebook\",\n            name: item.name,\n            card: null,\n            world: toWorld(item.book),\n            worldName: item.book.name || item.name,\n            persona: null,\n        };\n    }\n    const persona = item.persona || { name: item.name, title: item.name, description: item.blurb || \"\", lorebookName: \"\" };\n    return {\n        id: item.id,\n        kind: \"persona\",\n        name: persona.name,\n        card: null,\n        world: item.book && item.book.entries && item.book.entries.length ? toWorld(item.book) : null,\n        worldName: persona.lorebookName || (item.book ? item.book.name : null),\n        persona,\n    };\n}\n\nfunction paintPortrait(name) {\n    const canvas = document.createElement(\"canvas\");\n    canvas.width = 512;\n    canvas.height = 512;\n    const g = canvas.getContext(\"2d\");\n    let hash = 2166136261;\n    for (let i = 0; i < name.length; i++) {\n        hash ^= name.charCodeAt(i);\n        hash = Math.imul(hash, 16777619);\n    }\n    const lift = 22 + (hash >>> 0) % 18;\n    g.fillStyle = `rgb(${lift + 10}, ${lift + 8}, ${lift + 4})`;\n    g.fillRect(0, 0, 512, 512);\n    g.fillStyle = \"#f4f0e8\";\n    g.fillRect(48, 250, 416, 2);\n    const parts = name.split(/\\s+/).filter(Boolean);\n    const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();\n    g.font = \"600 168px Palatino, 'Iowan Old Style', serif\";\n    g.textAlign = \"center\";\n    g.textBaseline = \"middle\";\n    g.fillText(initials, 256, 200);\n    g.font = \"500 28px Palatino, 'Iowan Old Style', serif\";\n    g.fillText(name.slice(0, 28), 256, 320);\n    return new Promise((resolve, reject) => {\n        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(\"Could not draw a portrait\"))), \"image/png\");\n    });\n}\n\nasync function cardPng(st) {\n    const portrait = await paintPortrait(st.name);\n    const base = await portrait.arrayBuffer();\n    const v3 = st.card;\n    const v2 = { spec: \"chara_card_v2\", spec_version: \"2.0\", data: v3.data };\n    let next = injectTextChunk(base, \"chara\", utf8ToBase64(JSON.stringify(v2)));\n    next = injectTextChunk(next, \"ccv3\", utf8ToBase64(JSON.stringify(v3)));\n    return new Blob([next], { type: \"image/png\" });\n}\n\nfunction ctx() {\n    return SillyTavern.getContext();\n}\n\nfunction settings() {\n    const context = ctx();\n    if (!context.extensionSettings[MODULE]) {\n        context.extensionSettings[MODULE] = { vaultUrl: \"\", personalUrl: \"\", token: \"\", saveEmbeddedWorlds: true };\n    }\n    return context.extensionSettings[MODULE];\n}\n\nfunction saveSettings() {\n    ctx().saveSettingsDebounced();\n}\n\nfunction authHeaders() {\n    const headers = { accept: \"application/json\" };\n    const token = String(settings().token || \"\").trim();\n    if (token) headers.authorization = `Bearer ${token}`;\n    return headers;\n}\n\nfunction siteRoot(input) {\n    return String(input || \"\").trim().replace(/\\/$/, \"\").replace(/\\/api\\/v1\\/catalog$/, \"\").replace(/\\/api\\/export$/, \"\").replace(/\\/export\\.json$/, \"\");\n}\n\nasync function pullSource(base, label) {\n    const root = siteRoot(base);\n    if (!root) return [];\n    const urls = [`${root}/api/v1/catalog`, `${root}/api/export`, `${root}/export.json`];\n    let last = `${label}: no catalog at that address`;\n    for (const url of urls) {\n        try {\n            const res = await fetch(url, { headers: authHeaders() });\n            if (!res.ok) {\n                last = `${label}: ${res.status} from ${url}`;\n                continue;\n            }\n            const data = await res.json();\n            if (Array.isArray(data.items) && data.items.length && data.items[0].kind && data.protocol) {\n                return data.items.map((item) => ({ ...item, _base: root, _remote: true, _label: label }));\n            }\n            const adapted = adaptPayload(data).map((item) => ({ ...item, _remote: false, _label: label }));\n            if (adapted.length) return adapted;\n            last = `${label}: that address answered, but not with cards, lorebooks, or personas`;\n        } catch (error) {\n            last = `${label}: ${error.message}`;\n        }\n    }\n    throw new Error(last);\n}\n\nasync function fetchSt(item) {\n    const res = await fetch(`${item._base}/api/v1/items/${encodeURIComponent(item.id)}?format=sillytavern`, { headers: authHeaders() });\n    if (!res.ok) throw new Error(`Could not read ${item.name}`);\n    return res.json();\n}\n\nasync function saveWorld(name, data) {\n    const clean = safeFileName(name);\n    try {\n        const wi = await import(\"/scripts/world-info.js\");\n        if (typeof wi.saveWorldInfo === \"function\") {\n            await wi.saveWorldInfo(clean, data, true);\n            if (typeof wi.updateWorldInfoList === \"function\") await wi.updateWorldInfoList();\n            return clean;\n        }\n    } catch (error) {\n        console.warn(\"Vellum Bridge world-info module\", error);\n    }\n    const res = await fetch(\"/api/worldinfo/edit\", {\n        method: \"POST\",\n        headers: ctx().getRequestHeaders(),\n        body: JSON.stringify({ name: clean, data }),\n    });\n    if (!res.ok) throw new Error(`Lorebook “${clean}” was refused (${res.status})`);\n    return clean;\n}\n\nasync function importCard(st) {\n    const png = await cardPng(st);\n    const file = new File([png], `${safeFileName(st.name)}.png`, { type: \"image/png\" });\n    const form = new FormData();\n    form.append(\"avatar\", file);\n    form.append(\"file_type\", \"png\");\n    form.append(\"preserved_name\", \"true\");\n    const res = await fetch(\"/api/characters/import\", {\n        method: \"POST\",\n        headers: ctx().getRequestHeaders({ omitContentType: true }),\n        body: form,\n    });\n    const body = await res.json().catch(() => ({}));\n    if (!res.ok || body.error) throw new Error(`Card “${st.name}” was refused`);\n    try {\n        const script = await import(\"/script.js\");\n        if (typeof script.getCharacters === \"function\") await script.getCharacters();\n    } catch {\n        /* the card is stored even if the list does not refresh */\n    }\n}\n\nasync function importPersona(st) {\n    const png = await paintPortrait(st.persona.name);\n    const fileName = `${safeFileName(st.persona.name)}.png`;\n    const file = new File([png], fileName, { type: \"image/png\" });\n    const form = new FormData();\n    form.append(\"avatar\", file);\n    form.append(\"overwrite_name\", fileName);\n    const res = await fetch(\"/api/avatars/upload\", {\n        method: \"POST\",\n        headers: ctx().getRequestHeaders({ omitContentType: true }),\n        body: form,\n    });\n    const data = await res.json().catch(() => ({}));\n    if (!res.ok) throw new Error(`Persona “${st.persona.name}” was refused`);\n    const avatarId = data.path || fileName;\n    const personas = await import(\"/scripts/personas.js\");\n    const lorebook = st.world && st.worldName ? safeFileName(st.worldName) : (st.persona.lorebookName || \"\");\n    await personas.initPersona(avatarId, st.persona.name, st.persona.description || \"\", st.persona.title || st.persona.name, {\n        lorebook,\n    });\n    if (typeof personas.getUserAvatars === \"function\") await personas.getUserAvatars(true, avatarId);\n}\n\nasync function importOne(item, saveEmbedded) {\n    const st = item._remote ? await fetchSt(item) : toSillyTavern(item);\n    if (st.kind === \"lorebook\") {\n        if (!st.world) throw new Error(`${st.name} has no entries`);\n        await saveWorld(st.worldName || st.name, st.world);\n        return `Lorebook “${safeFileName(st.worldName || st.name)}”`;\n    }\n    if (st.kind === \"persona\") {\n        if (st.world && st.worldName) await saveWorld(st.worldName, st.world);\n        await importPersona(st);\n        return `Persona “${st.persona.name}”`;\n    }\n    await importCard(st);\n    if (saveEmbedded && st.world && st.worldName) await saveWorld(st.worldName, st.world);\n    return `Card “${st.name}”`;\n}\n\nconst state = { items: [], log: \"\" };\n\nfunction el(tag, attrs, children) {\n    const node = document.createElement(tag);\n    for (const [key, value] of Object.entries(attrs || {})) {\n        if (key === \"class\") node.className = value;\n        else if (key.startsWith(\"on\") && typeof value === \"function\") node.addEventListener(key.slice(2).toLowerCase(), value);\n        else if (value !== undefined && value !== false) node.setAttribute(key, value === true ? \"\" : String(value));\n    }\n    for (const child of children || []) node.append(child);\n    return node;\n}\n\nfunction render(root) {\n    const current = settings();\n    root.replaceChildren();\n    const vault = el(\"input\", { type: \"url\", value: current.vaultUrl, placeholder: \"https://your-vault.example\", id: \"vb-vault\" });\n    const personal = el(\"input\", { type: \"url\", value: current.personalUrl, placeholder: \"Optional — your Vellum or Archives\", id: \"vb-personal\" });\n    const token = el(\"input\", { type: \"password\", value: current.token, placeholder: \"Only if that shelf asks for one\", id: \"vb-token\", autocomplete: \"off\" });\n    const saveEmbedded = el(\"input\", { type: \"checkbox\", id: \"vb-embedded\" });\n    saveEmbedded.checked = current.saveEmbeddedWorlds !== false;\n    const remember = () => {\n        const next = settings();\n        next.vaultUrl = vault.value.trim();\n        next.personalUrl = personal.value.trim();\n        next.token = token.value;\n        next.saveEmbeddedWorlds = saveEmbedded.checked;\n        saveSettings();\n    };\n    vault.addEventListener(\"change\", remember);\n    personal.addEventListener(\"change\", remember);\n    token.addEventListener(\"change\", remember);\n    saveEmbedded.addEventListener(\"change\", remember);\n\n    const log = el(\"pre\", { class: \"vb-log\" }, [state.log || \"Paste a vault address, or import a bundle file.\"]);\n    const list = el(\"div\", { class: \"vb-list\" });\n    for (const item of state.items) {\n        const box = el(\"input\", { type: \"checkbox\", \"data-id\": item.id });\n        box.checked = item._checked !== false;\n        box.addEventListener(\"change\", () => {\n            item._checked = box.checked;\n        });\n        const kind = item.kind === \"lorebook\" ? \"Lorebook\" : item.kind === \"persona\" ? \"Persona\" : \"Card\";\n        list.append(el(\"label\", { class: \"vb-item\" }, [\n            box,\n            el(\"span\", {}, [\n                document.createTextNode(item.name),\n                el(\"div\", { class: \"vb-kind\" }, [`${kind} · ${item._label || \"Bundle\"}`]),\n            ]),\n        ]));\n    }\n\n    const file = el(\"input\", { type: \"file\", accept: \"application/json,.json\", id: \"vb-file\" });\n    file.addEventListener(\"change\", async () => {\n        const picked = file.files && file.files[0];\n        file.value = \"\";\n        if (!picked) return;\n        try {\n            const parsed = JSON.parse(await picked.text());\n            let items = [];\n            const root = siteRoot(settings().vaultUrl);\n            if (root) {\n                try {\n                    const res = await fetch(`${root}/api/v1/adapt`, {\n                        method: \"POST\",\n                        headers: { \"content-type\": \"application/json\", ...authHeaders() },\n                        body: JSON.stringify(parsed),\n                    });\n                    if (res.ok) {\n                        const body = await res.json();\n                        items = (body.items || []).map((item) => ({ ...item, _remote: false, _label: \"Bundle\", _checked: true }));\n                    }\n                } catch {\n                    items = [];\n                }\n            }\n            if (!items.length) items = adaptPayload(parsed).map((item) => ({ ...item, _remote: false, _label: \"Bundle\", _checked: true }));\n            if (!items.length) throw new Error(\"That file had no cards, lorebooks, or personas.\");\n            state.items = items;\n            state.log = `${items.length} ready from ${picked.name}. Import when you are.`;\n        } catch (error) {\n            state.log = error.message;\n        }\n        render(root);\n    });\n\n    root.append(\n        el(\"label\", {}, [\"Central vault\", vault]),\n        el(\"label\", {}, [\"Your Vellum\", personal]),\n        el(\"label\", {}, [\"Token\", token]),\n        el(\"label\", { class: \"vb-check\" }, [saveEmbedded, \"Also save a card's lorebook as its own world\"]),\n        el(\"div\", { class: \"vb-actions\" }, [\n            el(\"button\", { type: \"button\", class: \"menu_button\", onclick: () => refresh(root) }, [\"Refresh shelf\"]),\n            el(\"button\", { type: \"button\", class: \"menu_button\", onclick: () => file.click() }, [\"Import bundle\"]),\n            el(\"button\", { type: \"button\", class: \"menu_button\", onclick: () => runImport(root) }, [\"Import selected\"]),\n        ]),\n        file,\n        list,\n        log,\n    );\n    file.hidden = true;\n}\n\nasync function refresh(root) {\n    rememberFrom(root);\n    state.log = \"Looking…\";\n    render(root);\n    const found = [];\n    const notes = [];\n    const current = settings();\n    for (const [url, label] of [[current.vaultUrl, \"Vault\"], [current.personalUrl, \"Yours\"]]) {\n        if (!siteRoot(url)) continue;\n        try {\n            const items = await pullSource(url, label);\n            for (const item of items) item._checked = true;\n            found.push(...items);\n            notes.push(`${label}: ${items.length}`);\n        } catch (error) {\n            notes.push(error.message);\n        }\n    }\n    state.items = found;\n    state.log = notes.length ? notes.join(\"\\n\") : \"Add a vault address or a bundle first.\";\n    render(root);\n}\n\nfunction rememberFrom() {\n    const vault = document.getElementById(\"vb-vault\");\n    const personal = document.getElementById(\"vb-personal\");\n    const token = document.getElementById(\"vb-token\");\n    const embedded = document.getElementById(\"vb-embedded\");\n    if (!vault) return;\n    const next = settings();\n    next.vaultUrl = vault.value.trim();\n    next.personalUrl = personal.value.trim();\n    next.token = token.value;\n    next.saveEmbeddedWorlds = embedded.checked;\n    saveSettings();\n}\n\nasync function runImport(root) {\n    rememberFrom();\n    const chosen = state.items.filter((item) => item._checked !== false);\n    if (!chosen.length) {\n        state.log = \"Nothing selected.\";\n        render(root);\n        return;\n    }\n    const lines = [];\n    for (const item of chosen) {\n        try {\n            lines.push(await importOne(item, settings().saveEmbeddedWorlds !== false));\n            state.log = lines.join(\"\\n\");\n            render(root);\n        } catch (error) {\n            lines.push(`${item.name}: ${error.message}`);\n            state.log = lines.join(\"\\n\");\n            render(root);\n        }\n    }\n    lines.push(\"Done.\");\n    state.log = lines.join(\"\\n\");\n    render(root);\n    if (typeof toastr !== \"undefined\") toastr.success(\"Vellum import finished\");\n}\n\nasync function mount() {\n    if (document.getElementById(\"vellum-bridge-settings\")) {\n        const root = document.getElementById(\"vb-root\");\n        if (root && !root.childElementCount) render(root);\n        return;\n    }\n    const context = ctx();\n    let html = \"\";\n    for (const folder of [\"third-party/vellum-bridge\", \"vellum-bridge\"]) {\n        try {\n            html = await context.renderExtensionTemplateAsync(folder, \"settings\");\n            if (html) break;\n        } catch {\n            html = \"\";\n        }\n    }\n    const host = document.getElementById(\"extensions_settings2\") || document.getElementById(\"extensions_settings\");\n    if (!host) return;\n    if (html) {\n        host.insertAdjacentHTML(\"beforeend\", html);\n    } else {\n        host.insertAdjacentHTML(\"beforeend\", `<div id=\"vellum-bridge-settings\"><div id=\"vb-root\"></div></div>`);\n    }\n    const root = document.getElementById(\"vb-root\");\n    if (root) render(root);\n}\n\nmount().catch((error) => console.error(\"Vellum Bridge\", error));\n";
var manifest_default = "{\n  \"display_name\": \"Vellum Bridge\",\n  \"loading_order\": 15,\n  \"requires\": [],\n  \"optional\": [],\n  \"js\": \"index.js\",\n  \"css\": \"style.css\",\n  \"author\": \"Vellum\",\n  \"version\": \"1.0.0\",\n  \"auto_update\": false,\n  \"minimum_client_version\": \"1.12.0\"\n}\n";
var README_default = "# Vellum Bridge\n\nSillyTavern extension that imports character cards, lorebooks, and personas from a Vellum vault.\n\n## Install\n\n1. Unzip this folder so it is named `vellum-bridge` (the manifest must sit directly inside it).\n2. Move it to `SillyTavern/public/scripts/extensions/third-party/vellum-bridge`.\n   For one user only, use `SillyTavern/data/<handle>/extensions/vellum-bridge` instead.\n3. Restart SillyTavern.\n4. Open Extensions and expand **Vellum Bridge**.\n\n## Use\n\n- Paste the central vault address, and optionally your own Vellum or Archives address. Refresh, tick what you want, and import.\n- Or export a bundle from the bridge site and use **Import bundle**. That is the path for a private shelf SillyTavern cannot reach.\n- Cards are written with **Import Character**. Lorebooks are saved as World Info. Personas are created with an avatar and an attached lorebook when the shelf had one.\n\nThe folder name has to stay `vellum-bridge`.\n";
var settings_default = "<div id=\"vellum-bridge-settings\">\n    <div class=\"inline-drawer\">\n        <div class=\"inline-drawer-toggle inline-drawer-header\">\n            <b>Vellum Bridge</b>\n            <div class=\"inline-drawer-icon fa-solid fa-circle-chevron-down down\"></div>\n        </div>\n        <div class=\"inline-drawer-content\">\n            <div id=\"vb-root\"></div>\n        </div>\n    </div>\n</div>\n";
var style_default = "#vb-root {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    margin-top: 8px;\n}\n\n#vb-root label {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    font-size: 0.9em;\n}\n\n#vb-root input[type=\"url\"],\n#vb-root input[type=\"text\"],\n#vb-root input[type=\"password\"] {\n    width: 100%;\n    box-sizing: border-box;\n}\n\n#vb-root .vb-actions,\n#vb-root .vb-filters {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 6px;\n    align-items: center;\n}\n\n#vb-root .vb-list {\n    max-height: 320px;\n    overflow: auto;\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n    padding-right: 4px;\n}\n\n#vb-root .vb-item {\n    display: flex;\n    gap: 8px;\n    align-items: flex-start;\n}\n\n#vb-root .vb-kind {\n    opacity: 0.7;\n    font-size: 0.8em;\n}\n\n#vb-root .vb-log {\n    margin: 0;\n    max-height: 160px;\n    overflow: auto;\n    white-space: pre-wrap;\n    font-size: 0.85em;\n    opacity: 0.9;\n}\n\n#vb-root .vb-check {\n    flex-direction: row;\n    align-items: center;\n    gap: 8px;\n}\n";
var Route$1 = createFileRoute("/api/v1/plugin")({ server: { handlers: {
	OPTIONS: () => empty(),
	GET: () => {
		return bytes(zipStore([
			textFile("vellum-bridge/manifest.json", manifest_default),
			textFile("vellum-bridge/index.js", vellum_bridge_default),
			textFile("vellum-bridge/style.css", style_default),
			textFile("vellum-bridge/settings.html", settings_default),
			textFile("vellum-bridge/README.md", README_default)
		]), "application/zip", "vellum-bridge.zip");
	}
} } });
var Route = createFileRoute("/api/v1/items/$id")({ server: { handlers: {
	OPTIONS: () => empty(),
	GET: ({ request, params }) => {
		const item = getVaultItem(params.id);
		if (!item) return json({ error: "Not in the vault" }, 404);
		if (new URL(request.url).searchParams.get("format") === "sillytavern") return json(toSillyTavern(item));
		return json(item);
	}
} } });
var rootRouteChildren = {
	IndexRoute: Route$5.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$6
	}),
	ApiV1AdaptRoute: Route$4.update({
		id: "/api/v1/adapt",
		path: "/api/v1/adapt",
		getParentRoute: () => Route$6
	}),
	ApiV1CatalogRoute: Route$3.update({
		id: "/api/v1/catalog",
		path: "/api/v1/catalog",
		getParentRoute: () => Route$6
	}),
	ApiV1HealthRoute: Route$2.update({
		id: "/api/v1/health",
		path: "/api/v1/health",
		getParentRoute: () => Route$6
	}),
	ApiV1PluginRoute: Route$1.update({
		id: "/api/v1/plugin",
		path: "/api/v1/plugin",
		getParentRoute: () => Route$6
	}),
	ApiV1ItemsIdRoute: Route.update({
		id: "/api/v1/items/$id",
		path: "/api/v1/items/$id",
		getParentRoute: () => Route$6
	})
};
var routeTree = Route$6._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { toV2Card as a, zipStore as c, SAMPLE_WORLD as d, adaptPayload as f, toSillyTavern as i, SAMPLE_ARCHIVES as l, VAULT as n, asArrayBuffer as o, safeFileName as r, textFile as s, router_exports as t, SAMPLE_EDITOR as u };
