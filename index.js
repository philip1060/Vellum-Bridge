// Vellum for SillyTavern: paste a Vellum link, press Add.
// Talks to Vellum's own API (/api/v1) with a read-only key, then hands the result to
// SillyTavern's normal importers, so it behaves exactly like dropping in a file. Other sites
// with the same API (The Scriptorium) can be listed too, each with its own address and key;
// the host of a pasted link decides which site it comes from.
import { getRequestHeaders, processDroppedFiles } from '../../../../script.js';
import { convertCharacterBook, importWorldInfo, loadWorldInfo, saveWorldInfo, updateWorldInfoList, world_names } from '../../../world-info.js';
import { getUserAvatar, getUserAvatars, initPersona, setPersonaDescription, user_avatar } from '../../../personas.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

const MODULE = 'vellum';
const DEFAULT_SITE = 'https://vellum.thecentralempire.com';
const KINDS = {
    c: { api: 'cards', label: 'Character' },
    l: { api: 'lorebooks', label: 'Lorebook' },
    p: { api: 'personas', label: 'Persona' },
};
const ALL_KINDS = ['cards', 'lorebooks', 'personas'];

// ---- settings --------------------------------------------------------------------------
// extensionSettings.vellum = { sites: [{ id, label, url, apiKey, name?, kinds? }], defaultSite }
// The 'vellum' entry is always there; bare links like "c/123" go to defaultSite.

function ctx() {
    return SillyTavern.getContext();
}

/** "Vellum.example.com/" → "https://vellum.example.com"; null when it is not an address. */
function normalizeUrl(raw) {
    let text = String(raw ?? '').trim();
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
    try {
        const url = new URL(text);
        return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
        return null;
    }
}

/** The part two addresses must share to be the same site: the origin, with or without www. */
function originKey(raw) {
    try {
        const url = new URL(raw);
        return `${url.protocol}//${url.host.replace(/^www\./, '')}`;
    } catch {
        return '';
    }
}

function settings() {
    const all = ctx().extensionSettings;
    const s = (all[MODULE] ??= {});
    if (!Array.isArray(s.sites)) {
        // Older versions kept one address and one key.
        s.sites = [{ id: 'vellum', label: 'Vellum', url: normalizeUrl(s.site) || DEFAULT_SITE, apiKey: s.apiKey || '' }];
        delete s.site;
        delete s.apiKey;
    }
    if (!s.sites.some((x) => x.id === 'vellum')) s.sites.unshift({ id: 'vellum', label: 'Vellum', url: DEFAULT_SITE, apiKey: '' });
    s.defaultSite ??= 'vellum';
    return s;
}

function saveSettings() {
    ctx().saveSettingsDebounced();
}

function siteLabel(site) {
    if (site.label?.trim()) return site.label.trim();
    if (site.name) return site.name;
    try {
        return new URL(site.url).host;
    } catch {
        return 'this site';
    }
}

function defaultSite() {
    const s = settings();
    return s.sites.find((x) => x.id === s.defaultSite) ?? s.sites[0];
}

function siteForUrl(raw) {
    const key = originKey(raw);
    return key ? settings().sites.find((x) => x.url && originKey(x.url) === key) ?? null : null;
}

/** What a site offers: what its /me said, or everything for Vellum until it is checked. */
function siteKinds(site) {
    return site.kinds ?? (site.id === 'vellum' ? ALL_KINDS : null);
}

/** The keyed sites (that offer `kind`, when given) by name: "Vellum or The Scriptorium". */
function siteNames(kind) {
    const names = settings().sites
        .filter((x) => x.apiKey?.trim() && (!kind || (siteKinds(x) ?? ALL_KINDS).includes(kind)))
        .map(siteLabel);
    if (names.length <= 1) return names[0] ?? 'Vellum';
    return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

// ---- the API ---------------------------------------------------------------------------

/** A hint when the key looks like it belongs to the other kind of site. */
function keyMismatch(site, key) {
    const scriptorium = site.name ? site.name !== 'Vellum' : site.id !== 'vellum';
    if (key.startsWith('scr_') && !scriptorium) return ' That is a Scriptorium key (scr_…), but this address is Vellum.';
    if (key.startsWith('vlm_') && scriptorium) return ` That is a Vellum key (vlm_…), but this address is ${siteLabel(site)}.`;
    return '';
}

async function api(site, path) {
    const label = siteLabel(site);
    const key = (site.apiKey ?? '').trim();
    if (!key) throw new Error(`Add your ${label} API key first (Extensions → Vellum).`);
    let res;
    try {
        res = await fetch(`${site.url}/api/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
    } catch {
        throw new Error(`Could not reach ${label}. Check its address.`);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        // A 403 not_let_in (a private site that no longer lets the key's owner in) is shown as is.
        let message = body?.error?.message || `${label} answered ${res.status}.`;
        if (res.status === 401) message += keyMismatch(site, key);
        if (res.status === 404 && /^(cards|lorebooks|personas)\/\d+$/.test(path)) {
            message += ` If it is NSFW, it may be hidden by your Ratings settings on ${label}.`;
        }
        throw Object.assign(new Error(message), { status: res.status, code: body?.error?.code });
    }
    return body;
}

/**
 * "https://host/c/85042" → { site, kind: 'c', id: '85042' }; "c/85042" → the default site;
 * a host that is not in the list → { unknownHost }.
 */
function parseLink(text) {
    const raw = String(text).trim();
    const match = raw.match(/(?:^|\/)([clp])\/([1-9]\d{0,9})(?=$|[/?#-])/);
    if (!match) return null;
    const link = { kind: match[1], id: match[2], site: defaultSite() };
    if (/^https?:\/\//i.test(raw)) {
        link.site = siteForUrl(raw);
        if (!link.site) link.unknownHost = new URL(raw).host;
    }
    return link;
}

// ---- pictures --------------------------------------------------------------------------

/**
 * Vellum pictures are fetched straight from the site; if the browser is not allowed to
 * read them, SillyTavern's own CORS proxy is tried (only when it is turned on).
 */
async function fetchImage(url) {
    if (!url) return null;
    for (const candidate of [url, `/proxy/${url}`]) {
        try {
            const res = await fetch(candidate);
            if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) return await res.blob();
        } catch {
            // try the next way
        }
    }
    return null;
}

function canvasToPng(canvas) {
    return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the picture.'))), 'image/png'));
}

async function toPng(blob) {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return canvasToPng(canvas);
}

/** A plain stand-in portrait with the name's initials, for when the real one can't be read. */
function placeholder(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 600;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1d1b18';
    g.fillRect(0, 0, 400, 600);
    g.fillStyle = '#efe8da';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    g.font = '600 150px Georgia, serif';
    g.fillText(initials, 200, 270);
    g.font = '28px Georgia, serif';
    g.fillText(name.slice(0, 24), 200, 420);
    return canvasToPng(canvas);
}

/** The real picture as a PNG, or a placeholder. `missing` tells the caller which it got. */
async function portrait(url, name) {
    const blob = await fetchImage(url);
    if (blob) {
        try {
            return { png: await toPng(blob), missing: false };
        } catch {
            // fall through to the placeholder
        }
    }
    return { png: await placeholder(name), missing: true };
}

// ---- PNG card text ---------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function base64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

/** Write the card into the PNG the way SillyTavern does: tEXt `chara` (V2) and `ccv3` (V3). */
/** Each PNG chunk up to IEND: its type, its data, and the whole chunk (length, type, data, CRC). */
function* pngChunks(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        const end = offset + 12 + length;
        if (type === 'IEND' || end > bytes.length) return;
        yield { type, data: bytes.subarray(offset + 8, offset + 8 + length), raw: bytes.subarray(offset, end) };
        offset = end;
    }
}

function textKeyword(chunk) {
    return chunk.type === 'tEXt' ? new TextDecoder().decode(chunk.data.subarray(0, chunk.data.indexOf(0))).toLowerCase() : '';
}

/** The character card inside a PNG (V3 `ccv3` first, then V2 `chara`), or null. */
function readCard(bytes) {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
    const texts = {};
    for (const chunk of pngChunks(bytes)) {
        const keyword = textKeyword(chunk);
        if (keyword === 'ccv3' || keyword === 'chara') texts[keyword] = chunk.data.subarray(chunk.data.indexOf(0) + 1);
    }
    for (const keyword of ['ccv3', 'chara']) {
        if (!texts[keyword]) continue;
        try {
            const binary = atob(new TextDecoder().decode(texts[keyword]));
            return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
        } catch {
            // try the other one
        }
    }
    return null;
}

async function embedCard(png, card) {
    const bytes = new Uint8Array(await png.arrayBuffer());
    const keep = [];
    for (const chunk of pngChunks(bytes)) {
        const keyword = textKeyword(chunk);
        if (keyword !== 'chara' && keyword !== 'ccv3') keep.push(chunk.raw);
    }
    const data = card.data ?? card;
    const text = (keyword, json) => {
        const body = new TextEncoder().encode(`${keyword}\0${base64Utf8(JSON.stringify(json))}`);
        const chunk = new Uint8Array(12 + body.length);
        const out = new DataView(chunk.buffer);
        out.setUint32(0, body.length);
        chunk.set(new TextEncoder().encode('tEXt'), 4);
        chunk.set(body, 8);
        out.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
        return chunk;
    };
    const iend = new Uint8Array([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    return new Blob([
        bytes.subarray(0, 8),
        ...keep,
        text('chara', { spec: 'chara_card_v2', spec_version: '2.0', data }),
        text('ccv3', { spec: 'chara_card_v3', spec_version: '3.0', data }),
        iend,
    ], { type: 'image/png' });
}

function fileName(name, fallback) {
    return String(name || fallback).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || fallback;
}

// ---- adding things to SillyTavern ------------------------------------------------------

const notes = [];

/** Vellum tags carry a category ("general:female"); SillyTavern gets just "female". */
function plainTags(tags) {
    if (!Array.isArray(tags)) return [];
    const out = [];
    for (const tag of tags) {
        const plain = String(tag).replace(/^[^:]*:/, '').trim();
        if (plain && !out.some((t) => t.toLowerCase() === plain.toLowerCase())) out.push(plain);
    }
    return out;
}

function pictureNote(site, name) {
    notes.push(`${name}: the picture on ${siteLabel(site)} could not be downloaded, so a placeholder was used.`);
}

/** Where a card came from, kept in the card: the same `vellum` key as before, plus the site. */
function origin(site, item) {
    return { id: item.id, url: item.url, site: site.url, site_name: siteLabel(site) };
}

async function addCharacter(site, id) {
    const item = await api(site, `cards/${id}`);
    const card = structuredClone(item.card ?? {});
    const data = card.data ?? card;
    data.extensions = { ...(data.extensions ?? {}), vellum: origin(site, item) };
    data.tags = plainTags(data.tags);
    // Picture addresses are used exactly as given: a private site's come signed (?exp=…&sig=…).
    const picture = await portrait(item.image_original_url || item.image_url, item.name);
    if (picture.missing) pictureNote(site, item.name);
    const png = await embedCard(picture.png, card);
    await processDroppedFiles([new File([png], `${fileName(item.name, 'character')}.png`, { type: 'image/png' })]);
    return item.name;
}

async function addLorebook(site, id) {
    const item = await api(site, `lorebooks/${id}`);
    let book = item.lorebook ?? {};
    if (book.spec === 'lorebook_v3' && book.data) book = book.data;
    if (Array.isArray(book.entries)) book = convertCharacterBook(structuredClone(book));
    const json = JSON.stringify({ ...book, name: item.name });
    await importWorldInfo(new File([json], `${fileName(item.name, 'lorebook')}.json`, { type: 'application/json' }));
    return item.name;
}

/** One avatar file per persona per site, so adding it again updates it instead of duplicating. */
function personaAvatarName(site, id) {
    if (site.id === 'vellum') return `vellum-p${id}.png`;
    const host = new URL(site.url).host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `vellum-${host}-p${id}.png`;
}

async function addPersona(site, id) {
    const item = await api(site, `personas/${id}`);
    const picture = await portrait(item.image_original_url || item.image_url, item.name);
    if (picture.missing) pictureNote(site, item.name);
    const avatarName = personaAvatarName(site, item.id);
    const form = new FormData();
    form.append('avatar', new File([picture.png], avatarName, { type: 'image/png' }));
    form.append('overwrite_name', avatarName);
    const res = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: form,
    });
    if (!res.ok) throw new Error(`SillyTavern refused the persona picture (${res.status}).`);
    const { path } = await res.json().catch(() => ({}));
    const avatarId = path || avatarName;
    await initPersona(avatarId, item.name, item.description || '', item.summary || '');
    await getUserAvatars(true, avatarId);
    toastr.success(`Persona added: ${item.name}`);
    return item.name;
}

const ADDERS = { c: addCharacter, l: addLorebook, p: addPersona };

/** Add every link found in the text, each from its own site. Returns how many worked. */
async function addFromText(text) {
    const links = String(text).split(/\s+/).map(parseLink).filter(Boolean);
    if (!links.length) {
        toastr.warning('Paste a link like …/c/123 (character), …/l/123 (lorebook) or …/p/123 (persona).');
        return 0;
    }
    notes.length = 0;
    let added = 0;
    for (const link of links) {
        const what = `${KINDS[link.kind].label} ${link.id}`;
        if (link.unknownHost) {
            toastr.warning(`Add ${link.unknownHost} under Extensions → Vellum → Sites to add from it.`, what);
            continue;
        }
        const kinds = siteKinds(link.site);
        if (kinds && !kinds.includes(KINDS[link.kind].api)) {
            toastr.warning(`${siteLabel(link.site)} has no ${KINDS[link.kind].api}.`, what);
            continue;
        }
        setStatus(`Adding ${what.toLowerCase()} from ${siteLabel(link.site)}…`);
        try {
            await ADDERS[link.kind](link.site, link.id);
            added++;
        } catch (error) {
            toastr.error(error.message, `${siteLabel(link.site)}: ${what}`);
        }
    }
    for (const note of notes) toastr.info(note, 'Vellum', { timeOut: 10000 });
    setStatus(added ? `Added ${added} of ${links.length}.` : '');
    return added;
}

// ---- persona PNGs --------------------------------------------------------------------
// A persona is saved as an ordinary SillyTavern character card, so without this extension it
// still opens as a character and SillyTavern's own "Convert to Persona" turns it back. The
// description has {{user}} and {{char}} swapped (as a card it describes {{char}}), the linked
// lorebook rides along as the card's embedded lorebook, and the persona-only settings sit in
// data.extensions.persona.

const PERSONA_NOTE = 'This is a SillyTavern persona saved as a character card. To use it as a persona, import it under '
    + 'Persona Management with the Vellum extension, or import it as a character and use "Convert to Persona" '
    + '(say yes to swapping {{char}} and {{user}}).';

function swapUserChar(text) {
    return String(text ?? '').replace(/{{(char|user)}}/gi, (_, who) => (who.toLowerCase() === 'char' ? '{{user}}' : '{{char}}'));
}

/** SillyTavern World Info as a card's embedded lorebook, the way SillyTavern writes it itself. */
function worldToCharacterBook(name, world) {
    const entries = Object.values(world?.entries ?? {}).map((e) => ({
        id: e.uid,
        keys: e.key ?? [],
        secondary_keys: e.keysecondary ?? [],
        comment: e.comment ?? '',
        content: e.content ?? '',
        constant: !!e.constant,
        selective: !!e.selective,
        insertion_order: e.order ?? 100,
        enabled: !e.disable,
        position: e.position == 0 ? 'before_char' : 'after_char',
        use_regex: true,
        extensions: {
            ...e.extensions,
            position: e.position,
            exclude_recursion: e.excludeRecursion,
            display_index: e.displayIndex,
            probability: e.probability ?? null,
            useProbability: e.useProbability ?? false,
            depth: e.depth ?? 4,
            selectiveLogic: e.selectiveLogic ?? 0,
            outlet_name: e.outletName ?? '',
            group: e.group ?? '',
            group_override: e.groupOverride ?? false,
            group_weight: e.groupWeight ?? null,
            prevent_recursion: e.preventRecursion ?? false,
            delay_until_recursion: e.delayUntilRecursion ?? false,
            scan_depth: e.scanDepth ?? null,
            match_whole_words: e.matchWholeWords ?? null,
            use_group_scoring: e.useGroupScoring ?? false,
            case_sensitive: e.caseSensitive ?? null,
            automation_id: e.automationId ?? '',
            role: e.role ?? 0,
            vectorized: e.vectorized ?? false,
            sticky: e.sticky ?? null,
            cooldown: e.cooldown ?? null,
            delay: e.delay ?? null,
            match_persona_description: e.matchPersonaDescription ?? false,
            match_character_description: e.matchCharacterDescription ?? false,
            match_character_personality: e.matchCharacterPersonality ?? false,
            match_character_depth_prompt: e.matchCharacterDepthPrompt ?? false,
            match_scenario: e.matchScenario ?? false,
            match_creator_notes: e.matchCreatorNotes ?? false,
            triggers: e.triggers ?? [],
            ignore_budget: e.ignoreBudget ?? false,
        },
    }));
    return { name, entries };
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Save the persona that is open in Persona Management as a character-card PNG. */
async function exportPersona() {
    const power = ctx().powerUserSettings;
    const avatarId = user_avatar;
    const name = power.personas?.[avatarId];
    if (!name) {
        toastr.warning('Pick a persona first.');
        return;
    }
    const persona = power.persona_descriptions?.[avatarId] ?? {};
    const picture = await fetch(getUserAvatar(encodeURIComponent(avatarId))).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    const png = picture ? await toPng(picture) : await placeholder(name);

    let book = null;
    if (persona.lorebook && world_names?.includes(persona.lorebook)) {
        const world = await loadWorldInfo(persona.lorebook);
        if (world?.entries && Object.keys(world.entries).length) book = worldToCharacterBook(persona.lorebook, world);
    }
    const data = {
        name,
        description: swapUserChar(persona.description ?? ''),
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creator_notes: PERSONA_NOTE,
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        group_only_greetings: [],
        tags: ['persona'],
        creator: '',
        character_version: '',
        extensions: {
            persona: {
                version: 1,
                title: persona.title ?? '',
                position: persona.position,
                depth: persona.depth,
                role: persona.role,
                lorebook: book ? persona.lorebook : '',
            },
            ...(book ? { world: persona.lorebook } : {}),
        },
        ...(book ? { character_book: book } : {}),
    };
    downloadBlob(await embedCard(png, { data }), `${fileName(name, 'persona')}.png`);
    toastr.success(`Saved ${name} as a PNG.`);
}

/** Keep an embedded lorebook as World Info; returns the name it was saved under. */
async function saveEmbeddedBook(book, wanted) {
    const name = fileName(wanted, 'Persona lorebook');
    if (world_names?.includes(name)) {
        const replace = await callGenericPopup(`A lorebook named "${name}" already exists. Replace it with the one in this persona?`, POPUP_TYPE.CONFIRM);
        if (!replace) return name;
    }
    await saveWorldInfo(name, convertCharacterBook(structuredClone(book)), true);
    await updateWorldInfoList();
    return name;
}

/** Make a persona from a character-card PNG: a persona export, or any character card. */
async function importPersonaFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const card = readCard(bytes);
    if (!card) throw new Error('There is no character card inside this PNG.');
    const data = card.data ?? card;
    const name = String(data.name ?? '').trim() || file.name.replace(/\.png$/i, '');
    const saved = data.extensions?.persona ?? {};
    const power = ctx().powerUserSettings;

    const avatarId = `${fileName(name, 'persona')} (Persona).png`;
    if (power.personas?.[avatarId]) {
        const replace = await callGenericPopup(`The persona "${name}" already exists. Replace it?`, POPUP_TYPE.CONFIRM);
        if (!replace) return null;
    }

    let lorebook = '';
    if (data.character_book?.entries?.length) {
        lorebook = await saveEmbeddedBook(data.character_book, data.extensions?.world || data.character_book.name || `${name} lorebook`);
    } else if (saved.lorebook && world_names?.includes(saved.lorebook)) {
        lorebook = saved.lorebook;
    }

    const form = new FormData();
    form.append('avatar', new File([bytes], avatarId, { type: 'image/png' }));
    form.append('overwrite_name', avatarId);
    const res = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: form,
    });
    if (!res.ok) throw new Error(`SillyTavern refused the picture (${res.status}).`);
    const { path } = await res.json().catch(() => ({}));
    const id = path || avatarId;

    const description = swapUserChar(data.description ?? '');
    const options = { lorebook };
    for (const key of ['position', 'depth', 'role']) if (saved[key] !== undefined && saved[key] !== null) options[key] = saved[key];
    await initPersona(id, name, description, saved.title ?? '', options);
    if (user_avatar === id) {
        power.persona_description = description;
        setPersonaDescription();
    }
    await getUserAvatars(true, id);
    return name;
}

const personaPicker = el('input', { type: 'file', accept: '.png,image/png', multiple: true, hidden: true });
personaPicker.addEventListener('change', async () => {
    const files = [...personaPicker.files];
    personaPicker.value = '';
    for (const file of files) {
        try {
            const name = await importPersonaFile(file);
            if (name) toastr.success(`Persona added: ${name}`);
        } catch (error) {
            toastr.error(error.message, `Could not import ${file.name}`);
        }
    }
});

// ---- panel -----------------------------------------------------------------------------

function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
}

let statusLine;
function setStatus(text) {
    if (statusLine) statusLine.textContent = text;
}

/** SillyTavern's styles override the `hidden` attribute, so set display directly. */
function showIf(node, visible) {
    node.style.display = visible ? '' : 'none';
}

function button(label, onClick, extra = '') {
    return el('div', { className: `menu_button ${extra}`.trim(), textContent: label, onclick: onClick });
}

function addRow() {
    const input = el('textarea', {
        className: 'text_pole vellum-link',
        rows: 1,
        placeholder: 'Paste a link from Vellum or another site you added',
    });
    const go = async () => {
        if (await addFromText(input.value)) input.value = '';
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            go();
        }
    });
    return el('div', { className: 'vellum-row' }, input, button('Add', go, 'vellum-add'));
}

/** Remember what a site's /me said: its name and what it offers. */
function remember(site, me) {
    site.name = me.site?.name ?? 'Vellum';
    site.kinds = Array.isArray(me.site?.kinds) ? me.site.kinds : ALL_KINDS;
    saveSettings();
}

let refreshBrowseSites = () => {};

function browseSection() {
    const siteSel = el('select', { className: 'text_pole' });
    const show = el('select', { className: 'text_pole' },
        el('option', { value: 'all', textContent: 'All of Vellum' }),
        el('option', { value: 'favorites', textContent: 'My favorites' }));
    const kind = el('select', { className: 'text_pole' });
    const sort = el('select', { className: 'text_pole' },
        el('option', { value: 'new', textContent: 'Newest' }),
        el('option', { value: 'loved', textContent: 'Most loved' }),
        el('option', { value: 'downloaded', textContent: 'Most downloaded' }),
        el('option', { value: 'views', textContent: 'Most viewed' }));
    const query = el('input', { className: 'text_pole', type: 'search', placeholder: 'Search Vellum' });
    const results = el('div', { className: 'vellum-results' });
    const more = button('More', () => load(true), 'vellum-more');
    const addAll = button('Add all shown', async () => {
        const links = [...results.querySelectorAll('.vellum-result a')].map((a) => a.href);
        if (!links.length) return;
        addAll.classList.add('disabled');
        await addFromText(links.join('\n'));
        addAll.classList.remove('disabled');
    }, 'vellum-more');
    showIf(more, false);
    showIf(addAll, false);
    let offset = 0;

    const currentSite = () => settings().sites.find((x) => x.id === siteSel.value) ?? defaultSite();

    /** The site picker lists the sites that have a key; it hides when there is only one. */
    function fillSites() {
        const keyed = settings().sites.filter((x) => x.apiKey?.trim());
        const was = siteSel.value;
        siteSel.replaceChildren(...keyed.map((x) => el('option', { value: x.id, textContent: siteLabel(x) })));
        if (keyed.some((x) => x.id === was)) siteSel.value = was;
        showIf(siteSel, keyed.length > 1);
    }

    /** Only the kinds this site offers (asks its /me the first time). */
    async function fillKinds(site) {
        let kinds = siteKinds(site);
        if (!kinds) {
            try {
                remember(site, await api(site, 'me'));
                kinds = site.kinds;
            } catch {
                kinds = ALL_KINDS;
            }
        }
        const was = kind.value;
        kind.replaceChildren(...Object.entries(KINDS)
            .filter(([, v]) => kinds.includes(v.api))
            .map(([k, v]) => el('option', { value: k, textContent: `${v.label}s` })));
        if ([...kind.options].some((o) => o.value === was)) kind.value = was;
        const label = siteLabel(site);
        show.options[0].textContent = `All of ${label}`;
        query.placeholder = `Search ${label}`;
    }

    async function load(append = false) {
        if (!append) {
            offset = 0;
            results.replaceChildren();
        }
        const site = currentSite();
        const k = kind.value || 'c';
        const favorites = show.value === 'favorites';
        showIf(sort, !favorites);
        // Vellum keeps no download count for personas.
        const downloaded = sort.querySelector('option[value="downloaded"]');
        downloaded.disabled = k === 'p';
        if (k === 'p' && sort.value === 'downloaded') sort.value = 'loved';
        const params = new URLSearchParams({ q: query.value.trim(), limit: '24', offset: String(offset) });
        if (!favorites) params.set('sort', sort.value);
        const path = favorites ? `me/favorites/${KINDS[k].api}` : KINDS[k].api;
        try {
            const page = await api(site, `${path}?${params}`);
            for (const item of page.data) results.append(resultCard(k, item));
            if (!results.childElementCount) {
                results.append(el('p', {
                    className: 'vellum-muted',
                    textContent: favorites ? `No favorites here yet. Heart things on ${siteLabel(site)} and they show up here.` : 'Nothing found.',
                }));
            }
            offset = page.paging.next_offset ?? offset;
            showIf(more, page.paging.has_more);
        } catch (error) {
            const message = favorites && error.status === 404
                ? `${siteLabel(site)} does not offer ${KINDS[k].label.toLowerCase()} favorites to extensions.`
                : error.message;
            results.replaceChildren(el('p', { className: 'vellum-muted', textContent: message }));
            showIf(more, false);
        }
        showIf(addAll, Boolean(results.querySelector('.vellum-result')));
    }

    async function reload() {
        fillSites();
        await fillKinds(currentSite());
        await load();
    }

    query.addEventListener('keydown', (e) => e.key === 'Enter' && load());
    siteSel.addEventListener('change', async () => {
        await fillKinds(currentSite());
        await load();
    });
    for (const select of [show, kind, sort]) select.addEventListener('change', () => load());

    const section = el('details', { className: 'vellum-browse', ontoggle: (e) => e.target.open && !results.childElementCount && reload() },
        el('summary', { textContent: 'Browse' }),
        el('div', { className: 'vellum-row' }, siteSel, show),
        el('div', { className: 'vellum-row' }, kind, sort),
        el('div', { className: 'vellum-row' }, query, button('Search', () => load())),
        results,
        el('div', { className: 'vellum-row' }, more, addAll));
    // When sites or keys change, start over if Browse is open, else on next open.
    refreshBrowseSites = () => {
        results.replaceChildren();
        fillSites();
        if (section.open) reload();
    };
    fillSites();
    return section;
}

function resultCard(kind, item) {
    const add = button('Add', async () => {
        add.classList.add('disabled');
        if (await addFromText(item.url)) add.textContent = 'Added';
        add.classList.remove('disabled');
    }, 'vellum-add');
    const meta = [
        item.creator,
        kind === 'l' && item.entries != null ? `${item.entries} entries` : null,
        item.favorites ? `♥ ${item.favorites}` : null,
    ].filter(Boolean).join(' · ');
    return el('div', { className: 'vellum-result' },
        item.image_url ? el('img', { src: item.image_url, loading: 'lazy', alt: '' }) : el('div', { className: 'vellum-noimg' }),
        el('div', { className: 'vellum-result-text' },
            el('a', { href: item.url, target: '_blank', rel: 'noopener', textContent: item.name }),
            el('small', { className: 'vellum-muted', textContent: meta })),
        add);
}

function siteRow(site, render) {
    const label = el('input', { className: 'text_pole', type: 'text', placeholder: 'Name (Check fills it in)', value: site.label ?? '' });
    const address = el('input', { className: 'text_pole', type: 'url', placeholder: 'https://…', value: site.url ?? '' });
    const key = el('input', { className: 'text_pole', type: 'password', placeholder: 'vlm_… or scr_…', value: site.apiKey ?? '', autocomplete: 'off' });
    const state = el('small', { className: 'vellum-muted' });
    const help = el('small', { className: 'vellum-muted' });
    const showHelp = () => {
        help.replaceChildren();
        if (site.url) {
            help.append('Make a key on that site under ',
                el('a', { href: `${site.url}/settings`, target: '_blank', rel: 'noopener', textContent: 'Settings → API keys' }),
                '. It is read-only.');
        }
    };
    const save = () => {
        const url = normalizeUrl(address.value) ?? '';
        if (url !== site.url) {
            // A new address is a new site until Check says what it is.
            delete site.name;
            delete site.kinds;
        }
        site.url = url;
        address.value = url;
        site.label = label.value.trim();
        site.apiKey = key.value.trim();
        saveSettings();
        showHelp();
        refreshBrowseSites();
    };
    for (const input of [label, address, key]) input.addEventListener('change', save);

    const check = async () => {
        save();
        if (!site.url) {
            state.textContent = 'Enter the site address first.';
            return;
        }
        const twin = settings().sites.find((x) => x !== site && x.url && originKey(x.url) === originKey(site.url));
        if (twin) {
            state.textContent = `"${siteLabel(twin)}" already uses this address.`;
            return;
        }
        state.textContent = 'Checking…';
        try {
            const me = await api(site, 'me');
            remember(site, me);
            if (!site.label) {
                site.label = site.name;
                label.value = site.name;
                saveSettings();
            }
            const ratings = [me.content?.show_nsfw && 'NSFW', me.content?.show_nsfl && 'NSFL'].filter(Boolean).join(' and ');
            const offers = site.kinds.map((k) => ({ cards: 'characters', lorebooks: 'lorebooks', personas: 'personas' })[k] ?? k).join(', ');
            state.textContent = `Connected to ${site.name}. ${ratings ? `${ratings} shown` : 'SFW only'} (change that in its Ratings settings). Offers ${offers}.`;
            refreshBrowseSites();
        } catch (error) {
            state.textContent = error.message;
        }
    };

    const remove = site.id === 'vellum' ? null : button('Remove', () => {
        const s = settings();
        s.sites = s.sites.filter((x) => x !== site);
        if (s.defaultSite === site.id) s.defaultSite = 'vellum';
        saveSettings();
        render();
        refreshBrowseSites();
    }, 'vellum-remove');

    showHelp();
    return el('div', { className: 'vellum-site' },
        el('div', { className: 'vellum-row' }, label, remove),
        address,
        el('div', { className: 'vellum-row' }, key, button('Check', check)),
        help,
        state);
}

function sitesSection() {
    const list = el('div', { className: 'vellum-sites' });
    const render = () => list.replaceChildren(...settings().sites.map((site) => siteRow(site, render)));
    const add = button('Add a site', () => {
        settings().sites.push({ id: `s${Date.now().toString(36)}`, label: '', url: '', apiKey: '' });
        saveSettings();
        render();
        list.lastElementChild?.querySelector('input[type=url]')?.focus();
    }, 'vellum-more');
    render();
    return el('details', { className: 'vellum-key', open: !settings().sites.some((x) => x.apiKey?.trim()) },
        el('summary', { textContent: 'Sites and API keys' }),
        el('small', { className: 'vellum-muted' }, 'Vellum, and any other site with the same API (such as a Scriptorium). A link goes to the site its address belongs to; links without an address go to Vellum.'),
        list,
        add);
}

function mountPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('vellum_panel')) return;
    statusLine = el('small', { className: 'vellum-muted vellum-status' });
    host.append(el('div', { id: 'vellum_panel', className: 'inline-drawer' },
        el('div', { className: 'inline-drawer-toggle inline-drawer-header' },
            el('b', { textContent: 'Vellum' }),
            el('div', { className: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
        el('div', { className: 'inline-drawer-content' }, addRow(), statusLine, browseSection(), sitesSection())));
}

const KIND_API = { character: 'cards', lorebook: 'lorebooks', persona: 'personas' };

async function askForLinks(what) {
    const text = await callGenericPopup(`Paste one or more ${what} links from ${siteNames(KIND_API[what])}:`, POPUP_TYPE.INPUT, '', { rows: 3, okButton: 'Add' });
    if (text) await addFromText(text);
}

/** "Add from Vellum" buttons where SillyTavern keeps characters, personas and lorebooks. */
function mountButtons() {
    const spots = [
        // Beside "Import from external URL" in the character list.
        { id: 'vellum_import_button', anchor: 'external_import_button', what: 'character', icon: true },
        // Beside "Create" in Persona Management.
        { id: 'vellum_persona_button', anchor: 'create_dummy_persona', what: 'persona' },
        // Beside "Import World Info" in the World Info panel.
        { id: 'vellum_world_button', anchor: 'world_import_button', what: 'lorebook', icon: true },
    ];
    for (const spot of spots) {
        const anchor = document.getElementById(spot.anchor);
        if (!anchor || document.getElementById(spot.id)) continue;
        const btn = spot.icon
            ? el('div', { id: spot.id, className: 'menu_button fa-solid fa-feather-pointed', title: 'Add from a link (Vellum or another site you added)' })
            : el('div', { id: spot.id, className: 'menu_button menu_button_icon', title: 'Add a persona from a Vellum link' },
                el('i', { className: 'fa-solid fa-feather-pointed fa-fw' }),
                el('div', { textContent: 'Vellum' }));
        btn.addEventListener('click', () => askForLinks(spot.what));
        anchor.after(btn);
    }

    // Persona PNGs: Import beside Create, Export with the open persona's own buttons.
    const create = document.getElementById('create_dummy_persona');
    if (create && !document.getElementById('vellum_persona_import')) {
        const importBtn = el('div', { id: 'vellum_persona_import', className: 'menu_button menu_button_icon', title: 'Import a persona from a PNG (a persona export or any character card)' },
            el('i', { className: 'fa-solid fa-file-import fa-fw' }),
            el('div', { textContent: 'Import' }));
        importBtn.addEventListener('click', () => personaPicker.click());
        create.after(importBtn);
        document.body.append(personaPicker);
    }
    const duplicate = document.getElementById('persona_duplicate_button');
    if (duplicate && !document.getElementById('vellum_persona_export')) {
        const exportBtn = el('div', { id: 'vellum_persona_export', className: 'menu_button fa-solid fa-file-export', title: 'Export this persona as a PNG' });
        exportBtn.addEventListener('click', () => exportPersona().catch((error) => toastr.error(error.message, 'Could not export the persona')));
        duplicate.after(exportBtn);
    }
}

function registerCommand() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    if (!SlashCommandParser?.addCommandObject) return;
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'vellum',
        aliases: ['scriptorium'],
        helpString: 'Add a character, lorebook or persona from a link to Vellum or another site listed under Extensions → Vellum. Example: <code>/vellum https://vellum.thecentralempire.com/c/123</code>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'link(s)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        })],
        callback: async (_args, value) => String(await addFromText(String(value ?? ''))),
    }));
}

jQuery(() => {
    settings();
    mountPanel();
    mountButtons();
    registerCommand();
});
