// Vellum Bridge — pull cards, lorebooks, and personas into SillyTavern.
const MODULE = "vellum_bridge";

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function injectTextChunk(pngBuffer, keyword, text) {
    const bytes = new Uint8Array(pngBuffer);
    const view = new DataView(pngBuffer);
    const kept = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset, false);
        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        const start = offset + 8;
        const end = start + length;
        if (end + 4 > bytes.length) break;
        const data = bytes.subarray(start, end);
        if (type === "tEXt") {
            const nul = data.indexOf(0);
            if (nul !== -1) {
                const kw = new TextDecoder().decode(data.subarray(0, nul));
                if (kw.toLowerCase() === keyword.toLowerCase()) {
                    offset = end + 4;
                    continue;
                }
            }
        }
        if (type === "IEND") break;
        kept.push({ type, data: new Uint8Array(data) });
        offset = end + 4;
    }
    const keyBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(text);
    const chunk = new Uint8Array(keyBytes.length + 1 + textBytes.length);
    chunk.set(keyBytes, 0);
    chunk[keyBytes.length] = 0;
    chunk.set(textBytes, keyBytes.length + 1);
    let total = 8 + 12 + chunk.length + 12;
    for (const part of kept) total += 12 + part.data.length;
    const out = new Uint8Array(total);
    out.set(bytes.subarray(0, 8), 0);
    let pos = 0;
    out.set(bytes.subarray(0, 8), 0);
    pos = 8;
    const write = (type, data) => {
        const typeBytes = new TextEncoder().encode(type);
        const viewOut = new DataView(out.buffer);
        viewOut.setUint32(pos, data.length, false);
        pos += 4;
        out.set(typeBytes, pos);
        pos += 4;
        out.set(data, pos);
        pos += data.length;
        const crcBuf = new Uint8Array(4 + data.length);
        crcBuf.set(typeBytes, 0);
        crcBuf.set(data, 4);
        viewOut.setUint32(pos, crc32(crcBuf), false);
        pos += 4;
    };
    for (const part of kept) write(part.type, part.data);
    write("tEXt", chunk);
    write("IEND", new Uint8Array(0));
    return out.buffer;
}

function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    const parts = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
        const slice = bytes.subarray(i, i + 0x8000);
        let bin = "";
        for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
        parts.push(bin);
    }
    return btoa(parts.join(""));
}

function safeFileName(name) {
    const cleaned = String(name || "import").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
    return (cleaned || "import").slice(0, 80);
}

function asList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((part) => part.trim()).filter(Boolean);
    return [];
}

function normalizeEntry(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const keys = asList(raw.keys ?? raw.key);
    const secondary = asList(raw.secondary_keys ?? raw.keysecondary);
    const content = String(raw.content || "");
    if (!content && !keys.length) return null;
    const position = raw.position === "after_char" || raw.position === 1 ? "after_char" : "before_char";
    return {
        keys,
        secondary_keys: secondary,
        content,
        comment: String(raw.comment || raw.name || keys[0] || `Entry ${index + 1}`),
        enabled: raw.enabled !== false && raw.disable !== true,
        constant: Boolean(raw.constant),
        selective: raw.selective !== undefined ? Boolean(raw.selective) : secondary.length > 0,
        insertion_order: Number(raw.insertion_order ?? raw.order ?? 100) || 0,
        position,
    };
}

function normalizeBook(raw, fallbackName) {
    if (!raw || typeof raw !== "object") return null;
    const entriesRaw = raw.entries;
    const list = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw && typeof entriesRaw === "object" ? Object.values(entriesRaw) : [];
    const entries = list.map(normalizeEntry).filter(Boolean);
    if (!entries.length && !raw.name && !fallbackName) return null;
    return {
        name: String(raw.name || fallbackName || "Lorebook"),
        description: String(raw.description || ""),
        scan_depth: Number(raw.scan_depth ?? 2) || 2,
        token_budget: Number(raw.token_budget ?? 512) || 512,
        recursive_scanning: Boolean(raw.recursive_scanning),
        entries,
    };
}

function cardFrom(raw) {
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    const book = normalizeBook(data.character_book, `${data.name || "Character"} lore`);
    return {
        name: String(data.name || "Untitled"),
        nickname: String(data.nickname || ""),
        description: String(data.description || ""),
        personality: String(data.personality || ""),
        scenario: String(data.scenario || ""),
        first_mes: String(data.first_mes || ""),
        mes_example: String(data.mes_example || ""),
        creator_notes: String(data.creator_notes || ""),
        system_prompt: String(data.system_prompt || ""),
        post_history_instructions: String(data.post_history_instructions || ""),
        alternate_greetings: asList(data.alternate_greetings),
        tags: asList(data.tags),
        creator: String(data.creator || ""),
        character_version: String(data.character_version || "1.0"),
        character_book: book && book.entries.length ? book : null,
    };
}

let localSeq = 0;

function adaptPayload(input) {
    if (Array.isArray(input)) return input.flatMap((entry) => adaptPayload(entry));
    if (!input || typeof input !== "object") return [];
    if (input.spec === "vellum_bundle_v1" || (input.cards || input.lorebooks || input.personas) && !input.data && !input.first_mes && !input.entries) {
        return [
            ...(Array.isArray(input.cards) ? input.cards.flatMap((entry) => adaptPayload(entry)) : []),
            ...(Array.isArray(input.lorebooks) ? input.lorebooks.flatMap((entry) => adaptPayload(entry)) : []),
            ...(Array.isArray(input.personas) ? input.personas.flatMap((entry) => adaptPayload({ ...entry, kind: "persona" })) : []),
        ];
    }
    const spec = String(input.spec || "");
    const data = input.data && typeof input.data === "object" ? input.data : input;
    const cardish = spec.startsWith("chara_card") || "first_mes" in data || "personality" in data || "character_book" in data;
    const entries = input.entries ?? data.entries;
    const worldish = !spec.startsWith("chara_card") && !("first_mes" in input) && !("personality" in input) && entries && typeof entries === "object";
    if (input.kind === "card" && input.card) return adaptPayload(input.card);
    if (input.kind === "lorebook" && input.book) return adaptPayload(input.book);
    if (input.kind === "persona" || (input.name && input.description && !cardish && !worldish)) {
        localSeq += 1;
        const book = normalizeBook(input.book || input.character_book, input.lorebookName || input.lorebook || "");
        return [{
            id: `persona-${localSeq}`,
            kind: "persona",
            name: String((input.persona && input.persona.name) || input.name || "Persona"),
            blurb: "",
            tags: [],
            persona: {
                name: String((input.persona && input.persona.name) || input.name || "Persona"),
                title: String((input.persona && input.persona.title) || input.title || input.name || ""),
                description: String((input.persona && input.persona.description) || input.description || ""),
                lorebookName: String((input.persona && input.persona.lorebookName) || input.lorebookName || input.lorebook || ""),
            },
            book: book && book.entries.length ? book : null,
        }];
    }
    if (worldish && !cardish) {
        const book = normalizeBook(input, input.name || "Lorebook");
        if (!book) return [];
        localSeq += 1;
        return [{ id: `lorebook-${localSeq}`, kind: "lorebook", name: book.name, blurb: book.description, tags: [], book }];
    }
    if (cardish && (data.name || input.name)) {
        const card = cardFrom(input);
        localSeq += 1;
        return [{ id: `card-${localSeq}`, kind: "card", name: card.name, blurb: "", tags: card.tags, card }];
    }
    return [];
}

function worldEntry(entry, index) {
    return {
        uid: index,
        key: entry.keys,
        keysecondary: entry.secondary_keys,
        comment: entry.comment,
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

function toWorld(book) {
    const entries = {};
    book.entries.forEach((entry, index) => {
        entries[String(index)] = worldEntry(entry, index);
    });
    return { entries };
}

function toCard(card, id) {
    const data = {
        name: card.name,
        nickname: card.nickname || "",
        description: card.description,
        personality: card.personality,
        scenario: card.scenario,
        first_mes: card.first_mes,
        mes_example: card.mes_example,
        creator_notes: card.creator_notes,
        system_prompt: card.system_prompt,
        post_history_instructions: card.post_history_instructions,
        alternate_greetings: card.alternate_greetings || [],
        tags: card.tags || [],
        creator: card.creator,
        character_version: card.character_version || "1.0",
        extensions: { vellum: { id, bridge: "vellum-bridge" } },
    };
    if (card.character_book && card.character_book.entries && card.character_book.entries.length) {
        data.character_book = {
            name: card.character_book.name,
            description: card.character_book.description || "",
            scan_depth: card.character_book.scan_depth ?? 2,
            token_budget: card.character_book.token_budget ?? 512,
            recursive_scanning: Boolean(card.character_book.recursive_scanning),
            extensions: {},
            entries: card.character_book.entries.map((entry, index) => ({
                id: index,
                keys: entry.keys,
                secondary_keys: entry.secondary_keys || [],
                content: entry.content,
                comment: entry.comment || "",
                enabled: entry.enabled !== false,
                constant: Boolean(entry.constant),
                selective: Boolean(entry.selective),
                insertion_order: entry.insertion_order ?? 100,
                position: entry.position === "after_char" ? "after_char" : "before_char",
                extensions: {},
            })),
        };
    }
    return { spec: "chara_card_v3", spec_version: "3.0", data };
}

function toSillyTavern(item) {
    if (item.kind === "card" && item.card) {
        const book = item.card.character_book;
        return {
            id: item.id,
            kind: "card",
            name: item.name,
            card: toCard(item.card, item.id),
            world: book && book.entries.length ? toWorld(book) : null,
            worldName: book && book.entries.length ? (book.name || `${item.name} lore`) : null,
            persona: null,
        };
    }
    if (item.kind === "lorebook" && item.book) {
        return {
            id: item.id,
            kind: "lorebook",
            name: item.name,
            card: null,
            world: toWorld(item.book),
            worldName: item.book.name || item.name,
            persona: null,
        };
    }
    const persona = item.persona || { name: item.name, title: item.name, description: item.blurb || "", lorebookName: "" };
    return {
        id: item.id,
        kind: "persona",
        name: persona.name,
        card: null,
        world: item.book && item.book.entries && item.book.entries.length ? toWorld(item.book) : null,
        worldName: persona.lorebookName || (item.book ? item.book.name : null),
        persona,
    };
}

function paintPortrait(name) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const g = canvas.getContext("2d");
    let hash = 2166136261;
    for (let i = 0; i < name.length; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const lift = 22 + (hash >>> 0) % 18;
    g.fillStyle = `rgb(${lift + 10}, ${lift + 8}, ${lift + 4})`;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = "#f4f0e8";
    g.fillRect(48, 250, 416, 2);
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
    g.font = "600 168px Palatino, 'Iowan Old Style', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(initials, 256, 200);
    g.font = "500 28px Palatino, 'Iowan Old Style', serif";
    g.fillText(name.slice(0, 28), 256, 320);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw a portrait"))), "image/png");
    });
}

async function cardPng(st) {
    const portrait = await paintPortrait(st.name);
    const base = await portrait.arrayBuffer();
    const v3 = st.card;
    const v2 = { spec: "chara_card_v2", spec_version: "2.0", data: v3.data };
    let next = injectTextChunk(base, "chara", utf8ToBase64(JSON.stringify(v2)));
    next = injectTextChunk(next, "ccv3", utf8ToBase64(JSON.stringify(v3)));
    return new Blob([next], { type: "image/png" });
}

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const context = ctx();
    if (!context.extensionSettings[MODULE]) {
        context.extensionSettings[MODULE] = { vaultUrl: "", personalUrl: "", token: "", saveEmbeddedWorlds: true };
    }
    return context.extensionSettings[MODULE];
}

function saveSettings() {
    ctx().saveSettingsDebounced();
}

function authHeaders() {
    const headers = { accept: "application/json" };
    const token = String(settings().token || "").trim();
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
}

function siteRoot(input) {
    return String(input || "").trim().replace(/\/$/, "").replace(/\/api\/v1\/catalog$/, "").replace(/\/api\/export$/, "").replace(/\/export\.json$/, "");
}

async function pullSource(base, label) {
    const root = siteRoot(base);
    if (!root) return [];
    const urls = [`${root}/api/v1/catalog`, `${root}/api/export`, `${root}/export.json`];
    let last = `${label}: no catalog at that address`;
    for (const url of urls) {
        try {
            const res = await fetch(url, { headers: authHeaders() });
            if (!res.ok) {
                last = `${label}: ${res.status} from ${url}`;
                continue;
            }
            const data = await res.json();
            if (Array.isArray(data.items) && data.items.length && data.items[0].kind && data.protocol) {
                return data.items.map((item) => ({ ...item, _base: root, _remote: true, _label: label }));
            }
            const adapted = adaptPayload(data).map((item) => ({ ...item, _remote: false, _label: label }));
            if (adapted.length) return adapted;
            last = `${label}: that address answered, but not with cards, lorebooks, or personas`;
        } catch (error) {
            last = `${label}: ${error.message}`;
        }
    }
    throw new Error(last);
}

async function fetchSt(item) {
    const res = await fetch(`${item._base}/api/v1/items/${encodeURIComponent(item.id)}?format=sillytavern`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Could not read ${item.name}`);
    return res.json();
}

async function saveWorld(name, data) {
    const clean = safeFileName(name);
    try {
        const wi = await import("/scripts/world-info.js");
        if (typeof wi.saveWorldInfo === "function") {
            await wi.saveWorldInfo(clean, data, true);
            if (typeof wi.updateWorldInfoList === "function") await wi.updateWorldInfoList();
            return clean;
        }
    } catch (error) {
        console.warn("Vellum Bridge world-info module", error);
    }
    const res = await fetch("/api/worldinfo/edit", {
        method: "POST",
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ name: clean, data }),
    });
    if (!res.ok) throw new Error(`Lorebook “${clean}” was refused (${res.status})`);
    return clean;
}

async function importCard(st) {
    const png = await cardPng(st);
    const file = new File([png], `${safeFileName(st.name)}.png`, { type: "image/png" });
    const form = new FormData();
    form.append("avatar", file);
    form.append("file_type", "png");
    form.append("preserved_name", "true");
    const res = await fetch("/api/characters/import", {
        method: "POST",
        headers: ctx().getRequestHeaders({ omitContentType: true }),
        body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(`Card “${st.name}” was refused`);
    try {
        const script = await import("/script.js");
        if (typeof script.getCharacters === "function") await script.getCharacters();
    } catch {
        /* the card is stored even if the list does not refresh */
    }
}

async function importPersona(st) {
    const png = await paintPortrait(st.persona.name);
    const fileName = `${safeFileName(st.persona.name)}.png`;
    const file = new File([png], fileName, { type: "image/png" });
    const form = new FormData();
    form.append("avatar", file);
    form.append("overwrite_name", fileName);
    const res = await fetch("/api/avatars/upload", {
        method: "POST",
        headers: ctx().getRequestHeaders({ omitContentType: true }),
        body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Persona “${st.persona.name}” was refused`);
    const avatarId = data.path || fileName;
    const personas = await import("/scripts/personas.js");
    const lorebook = st.world && st.worldName ? safeFileName(st.worldName) : (st.persona.lorebookName || "");
    await personas.initPersona(avatarId, st.persona.name, st.persona.description || "", st.persona.title || st.persona.name, {
        lorebook,
    });
    if (typeof personas.getUserAvatars === "function") await personas.getUserAvatars(true, avatarId);
}

async function importOne(item, saveEmbedded) {
    const st = item._remote ? await fetchSt(item) : toSillyTavern(item);
    if (st.kind === "lorebook") {
        if (!st.world) throw new Error(`${st.name} has no entries`);
        await saveWorld(st.worldName || st.name, st.world);
        return `Lorebook “${safeFileName(st.worldName || st.name)}”`;
    }
    if (st.kind === "persona") {
        if (st.world && st.worldName) await saveWorld(st.worldName, st.world);
        await importPersona(st);
        return `Persona “${st.persona.name}”`;
    }
    await importCard(st);
    if (saveEmbedded && st.world && st.worldName) await saveWorld(st.worldName, st.world);
    return `Card “${st.name}”`;
}

const state = { items: [], log: "" };

function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (key === "class") node.className = value;
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value !== undefined && value !== false) node.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of children || []) node.append(child);
    return node;
}

function render(root) {
    const current = settings();
    root.replaceChildren();
    const vault = el("input", { type: "url", value: current.vaultUrl, placeholder: "https://your-vault.example", id: "vb-vault" });
    const personal = el("input", { type: "url", value: current.personalUrl, placeholder: "Optional — your Vellum or Archives", id: "vb-personal" });
    const token = el("input", { type: "password", value: current.token, placeholder: "Only if that shelf asks for one", id: "vb-token", autocomplete: "off" });
    const saveEmbedded = el("input", { type: "checkbox", id: "vb-embedded" });
    saveEmbedded.checked = current.saveEmbeddedWorlds !== false;
    const remember = () => {
        const next = settings();
        next.vaultUrl = vault.value.trim();
        next.personalUrl = personal.value.trim();
        next.token = token.value;
        next.saveEmbeddedWorlds = saveEmbedded.checked;
        saveSettings();
    };
    vault.addEventListener("change", remember);
    personal.addEventListener("change", remember);
    token.addEventListener("change", remember);
    saveEmbedded.addEventListener("change", remember);

    const log = el("pre", { class: "vb-log" }, [state.log || "Paste a vault address, or import a bundle file."]);
    const list = el("div", { class: "vb-list" });
    for (const item of state.items) {
        const box = el("input", { type: "checkbox", "data-id": item.id });
        box.checked = item._checked !== false;
        box.addEventListener("change", () => {
            item._checked = box.checked;
        });
        const kind = item.kind === "lorebook" ? "Lorebook" : item.kind === "persona" ? "Persona" : "Card";
        list.append(el("label", { class: "vb-item" }, [
            box,
            el("span", {}, [
                document.createTextNode(item.name),
                el("div", { class: "vb-kind" }, [`${kind} · ${item._label || "Bundle"}`]),
            ]),
        ]));
    }

    const file = el("input", { type: "file", accept: "application/json,.json", id: "vb-file" });
    file.addEventListener("change", async () => {
        const picked = file.files && file.files[0];
        file.value = "";
        if (!picked) return;
        try {
            const parsed = JSON.parse(await picked.text());
            let items = [];
            const root = siteRoot(settings().vaultUrl);
            if (root) {
                try {
                    const res = await fetch(`${root}/api/v1/adapt`, {
                        method: "POST",
                        headers: { "content-type": "application/json", ...authHeaders() },
                        body: JSON.stringify(parsed),
                    });
                    if (res.ok) {
                        const body = await res.json();
                        items = (body.items || []).map((item) => ({ ...item, _remote: false, _label: "Bundle", _checked: true }));
                    }
                } catch {
                    items = [];
                }
            }
            if (!items.length) items = adaptPayload(parsed).map((item) => ({ ...item, _remote: false, _label: "Bundle", _checked: true }));
            if (!items.length) throw new Error("That file had no cards, lorebooks, or personas.");
            state.items = items;
            state.log = `${items.length} ready from ${picked.name}. Import when you are.`;
        } catch (error) {
            state.log = error.message;
        }
        render(root);
    });

    root.append(
        el("label", {}, ["Central vault", vault]),
        el("label", {}, ["Your Vellum", personal]),
        el("label", {}, ["Token", token]),
        el("label", { class: "vb-check" }, [saveEmbedded, "Also save a card's lorebook as its own world"]),
        el("div", { class: "vb-actions" }, [
            el("button", { type: "button", class: "menu_button", onclick: () => refresh(root) }, ["Refresh shelf"]),
            el("button", { type: "button", class: "menu_button", onclick: () => file.click() }, ["Import bundle"]),
            el("button", { type: "button", class: "menu_button", onclick: () => runImport(root) }, ["Import selected"]),
        ]),
        file,
        list,
        log,
    );
    file.hidden = true;
}

async function refresh(root) {
    rememberFrom(root);
    state.log = "Looking…";
    render(root);
    const found = [];
    const notes = [];
    const current = settings();
    for (const [url, label] of [[current.vaultUrl, "Vault"], [current.personalUrl, "Yours"]]) {
        if (!siteRoot(url)) continue;
        try {
            const items = await pullSource(url, label);
            for (const item of items) item._checked = true;
            found.push(...items);
            notes.push(`${label}: ${items.length}`);
        } catch (error) {
            notes.push(error.message);
        }
    }
    state.items = found;
    state.log = notes.length ? notes.join("\n") : "Add a vault address or a bundle first.";
    render(root);
}

function rememberFrom() {
    const vault = document.getElementById("vb-vault");
    const personal = document.getElementById("vb-personal");
    const token = document.getElementById("vb-token");
    const embedded = document.getElementById("vb-embedded");
    if (!vault) return;
    const next = settings();
    next.vaultUrl = vault.value.trim();
    next.personalUrl = personal.value.trim();
    next.token = token.value;
    next.saveEmbeddedWorlds = embedded.checked;
    saveSettings();
}

async function runImport(root) {
    rememberFrom();
    const chosen = state.items.filter((item) => item._checked !== false);
    if (!chosen.length) {
        state.log = "Nothing selected.";
        render(root);
        return;
    }
    const lines = [];
    for (const item of chosen) {
        try {
            lines.push(await importOne(item, settings().saveEmbeddedWorlds !== false));
            state.log = lines.join("\n");
            render(root);
        } catch (error) {
            lines.push(`${item.name}: ${error.message}`);
            state.log = lines.join("\n");
            render(root);
        }
    }
    lines.push("Done.");
    state.log = lines.join("\n");
    render(root);
    if (typeof toastr !== "undefined") toastr.success("Vellum import finished");
}

async function mount() {
    if (document.getElementById("vellum-bridge-settings")) {
        const root = document.getElementById("vb-root");
        if (root && !root.childElementCount) render(root);
        return;
    }
    const context = ctx();
    let html = "";
    for (const folder of ["third-party/vellum-bridge", "vellum-bridge"]) {
        try {
            html = await context.renderExtensionTemplateAsync(folder, "settings");
            if (html) break;
        } catch {
            html = "";
        }
    }
    const host = document.getElementById("extensions_settings2") || document.getElementById("extensions_settings");
    if (!host) return;
    if (html) {
        host.insertAdjacentHTML("beforeend", html);
    } else {
        host.insertAdjacentHTML("beforeend", `<div id="vellum-bridge-settings"><div id="vb-root"></div></div>`);
    }
    const root = document.getElementById("vb-root");
    if (root) render(root);
}

mount().catch((error) => console.error("Vellum Bridge", error));
