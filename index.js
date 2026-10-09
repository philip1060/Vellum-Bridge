// Vellum for SillyTavern: paste a Vellum link, press Add.
// Talks to Vellum's own API (/api/v1) with a read-only key, then hands the result to
// SillyTavern's normal importers, so it behaves exactly like dropping in a file.
import { getRequestHeaders, processDroppedFiles } from '../../../../script.js';
import { convertCharacterBook, importWorldInfo } from '../../../world-info.js';
import { getUserAvatars, initPersona } from '../../../personas.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

const MODULE = 'vellum';
const DEFAULT_SITE = 'https://vellum.thecentralempire.com';
const KINDS = {
    c: { api: 'cards', label: 'Character' },
    l: { api: 'lorebooks', label: 'Lorebook' },
    p: { api: 'personas', label: 'Persona' },
};

// ---- settings --------------------------------------------------------------------------

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const all = ctx().extensionSettings;
    all[MODULE] ??= {};
    all[MODULE].apiKey ??= '';
    all[MODULE].site ??= DEFAULT_SITE;
    return all[MODULE];
}

function site() {
    return (settings().site || DEFAULT_SITE).trim().replace(/\/+$/, '');
}

// ---- Vellum API ------------------------------------------------------------------------

async function api(path) {
    const key = settings().apiKey.trim();
    if (!key) throw new Error('Add your Vellum API key first (Extensions → Vellum).');
    let res;
    try {
        res = await fetch(`${site()}/api/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
    } catch {
        throw new Error('Could not reach Vellum. Check the site address.');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        let message = body?.error?.message || `Vellum answered ${res.status}.`;
        if (res.status === 404 && !path.startsWith('me/')) message += ' If it is NSFW, it may be hidden by your Ratings settings on Vellum.';
        throw Object.assign(new Error(message), { status: res.status });
    }
    return body;
}

/** "https://…/c/85042", "c/85042" → { kind: 'c', id: '85042' } */
function parseLink(text) {
    const match = String(text).trim().match(/(?:^|\/)([clp])\/([1-9]\d{0,9})(?=$|[/?#-])/);
    return match ? { kind: match[1], id: match[2] } : null;
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
async function embedCard(png, card) {
    const bytes = new Uint8Array(await png.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const keep = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        const end = offset + 12 + length;
        if (type === 'IEND' || end > bytes.length) break;
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        const keyword = type === 'tEXt' ? new TextDecoder().decode(data.subarray(0, data.indexOf(0))).toLowerCase() : '';
        if (keyword !== 'chara' && keyword !== 'ccv3') keep.push(bytes.subarray(offset, end));
        offset = end;
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

async function addCharacter(id) {
    const item = await api(`cards/${id}`);
    const card = structuredClone(item.card ?? {});
    const data = card.data ?? card;
    data.extensions = { ...(data.extensions ?? {}), vellum: { id: item.id, url: item.url } };
    const picture = await portrait(item.image_original_url || item.image_url, item.name);
    if (picture.missing) notes.push(`${item.name}: Vellum's picture could not be downloaded, so a placeholder was used.`);
    const png = await embedCard(picture.png, card);
    await processDroppedFiles([new File([png], `${fileName(item.name, 'character')}.png`, { type: 'image/png' })]);
    return item.name;
}

async function addLorebook(id) {
    const item = await api(`lorebooks/${id}`);
    let book = item.lorebook ?? {};
    if (book.spec === 'lorebook_v3' && book.data) book = book.data;
    if (Array.isArray(book.entries)) book = convertCharacterBook(structuredClone(book));
    const json = JSON.stringify({ ...book, name: item.name });
    await importWorldInfo(new File([json], `${fileName(item.name, 'lorebook')}.json`, { type: 'application/json' }));
    return item.name;
}

async function addPersona(id) {
    const item = await api(`personas/${id}`);
    const picture = await portrait(item.image_original_url || item.image_url, item.name);
    if (picture.missing) notes.push(`${item.name}: Vellum's picture could not be downloaded, so a placeholder was used.`);
    // One avatar file per Vellum persona, so adding it again updates it instead of duplicating.
    const avatarName = `vellum-p${item.id}.png`;
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

/** Add every Vellum link found in the text. Returns how many worked. */
async function addFromText(text) {
    const links = String(text).split(/\s+/).map(parseLink).filter(Boolean);
    if (!links.length) {
        toastr.warning('Paste a Vellum link like …/c/123 (character), …/l/123 (lorebook) or …/p/123 (persona).');
        return 0;
    }
    notes.length = 0;
    let added = 0;
    for (const link of links) {
        setStatus(`Adding ${KINDS[link.kind].label.toLowerCase()} ${link.id}…`);
        try {
            await ADDERS[link.kind](link.id);
            added++;
        } catch (error) {
            toastr.error(error.message, `Vellum: ${KINDS[link.kind].label} ${link.id}`);
        }
    }
    for (const note of notes) toastr.info(note, 'Vellum', { timeOut: 10000 });
    setStatus(added ? `Added ${added} of ${links.length}.` : '');
    return added;
}

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
        placeholder: 'Paste a Vellum link (character, lorebook or persona)',
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

function browseSection() {
    const show = el('select', { className: 'text_pole' },
        el('option', { value: 'all', textContent: 'All of Vellum' }),
        el('option', { value: 'favorites', textContent: 'My favorites' }));
    const kind = el('select', { className: 'text_pole' },
        ...Object.entries(KINDS).map(([k, v]) => el('option', { value: k, textContent: `${v.label}s` })));
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

    async function load(append = false) {
        if (!append) {
            offset = 0;
            results.replaceChildren();
        }
        const k = kind.value;
        const favorites = show.value === 'favorites';
        showIf(sort, !favorites);
        // Personas have no "loved" or "downloaded" sort; Vellum falls back to newest.
        const params = new URLSearchParams({ q: query.value.trim(), limit: '24', offset: String(offset) });
        if (!favorites) params.set('sort', sort.value);
        const path = favorites ? `me/favorites/${KINDS[k].api}` : KINDS[k].api;
        try {
            const page = await api(`${path}?${params}`);
            for (const item of page.data) results.append(resultCard(k, item));
            if (!results.childElementCount) {
                results.append(el('p', { className: 'vellum-muted', textContent: favorites ? 'No favorites here yet. Heart things on Vellum and they show up here.' : 'Nothing found.' }));
            }
            offset = page.paging.next_offset ?? offset;
            showIf(more, page.paging.has_more);
        } catch (error) {
            const message = favorites && error.status === 404
                ? `Vellum does not offer ${KINDS[k].label.toLowerCase()} favorites to extensions yet.`
                : error.message;
            results.replaceChildren(el('p', { className: 'vellum-muted', textContent: message }));
            showIf(more, false);
        }
        showIf(addAll, Boolean(results.querySelector('.vellum-result')));
    }

    query.addEventListener('keydown', (e) => e.key === 'Enter' && load());
    for (const select of [show, kind, sort]) select.addEventListener('change', () => load());

    return el('details', { className: 'vellum-browse', ontoggle: (e) => e.target.open && !results.childElementCount && load() },
        el('summary', { textContent: 'Browse Vellum' }),
        el('div', { className: 'vellum-row' }, show, kind, sort),
        el('div', { className: 'vellum-row' }, query, button('Search', () => load())),
        results,
        el('div', { className: 'vellum-row' }, more, addAll));
}

function resultCard(kind, item) {
    const add = button('Add', async () => {
        add.classList.add('disabled');
        if (await addFromText(item.url)) add.textContent = 'Added';
        add.classList.remove('disabled');
    }, 'vellum-add');
    const meta = [item.creator, kind === 'l' && item.entries != null ? `${item.entries} entries` : null].filter(Boolean).join(' · ');
    return el('div', { className: 'vellum-result' },
        item.image_url ? el('img', { src: item.image_url, loading: 'lazy', alt: '' }) : el('div', { className: 'vellum-noimg' }),
        el('div', { className: 'vellum-result-text' },
            el('a', { href: item.url, target: '_blank', rel: 'noopener', textContent: item.name }),
            el('small', { className: 'vellum-muted', textContent: meta })),
        add);
}

function keySection() {
    const s = settings();
    const key = el('input', { className: 'text_pole', type: 'password', placeholder: 'vlm_…', value: s.apiKey, autocomplete: 'off' });
    const address = el('input', { className: 'text_pole', type: 'url', value: s.site });
    const state = el('small', { className: 'vellum-muted' });
    const save = () => {
        s.apiKey = key.value.trim();
        s.site = address.value.trim() || DEFAULT_SITE;
        ctx().saveSettingsDebounced();
    };
    key.addEventListener('change', save);
    address.addEventListener('change', save);
    const check = async () => {
        save();
        state.textContent = 'Checking…';
        try {
            const me = await api('me');
            const ratings = [me.content?.show_nsfw && 'NSFW', me.content?.show_nsfl && 'NSFL'].filter(Boolean).join(' and ');
            state.textContent = `Connected. ${ratings ? `${ratings} shown` : 'SFW only'} (change that in Vellum's Ratings settings).`;
        } catch (error) {
            state.textContent = error.message;
        }
    };
    const help = el('small', { className: 'vellum-muted' }, 'Make a key on Vellum under ',
        el('a', { href: `${site()}/settings`, target: '_blank', rel: 'noopener', textContent: 'Settings → API keys' }),
        '. It is read-only.');
    return el('details', { className: 'vellum-key', open: !s.apiKey },
        el('summary', { textContent: 'API key' }),
        el('div', { className: 'vellum-row' }, key, button('Check', check)),
        help,
        state,
        el('label', { className: 'vellum-muted', textContent: 'Site address' }),
        address);
}

function mountPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('vellum_panel')) return;
    statusLine = el('small', { className: 'vellum-muted vellum-status' });
    host.append(el('div', { id: 'vellum_panel', className: 'inline-drawer' },
        el('div', { className: 'inline-drawer-toggle inline-drawer-header' },
            el('b', { textContent: 'Vellum' }),
            el('div', { className: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
        el('div', { className: 'inline-drawer-content' }, addRow(), statusLine, browseSection(), keySection())));
}

/** A small button beside "Import from external URL" in the character list. */
function mountCharacterButton() {
    const anchor = document.getElementById('external_import_button');
    if (!anchor || document.getElementById('vellum_import_button')) return;
    const btn = el('div', {
        id: 'vellum_import_button',
        className: 'menu_button fa-solid fa-feather-pointed',
        title: 'Add from Vellum',
    });
    btn.addEventListener('click', async () => {
        const text = await callGenericPopup('Paste one or more Vellum links (characters, lorebooks or personas):', POPUP_TYPE.INPUT, '', { rows: 3, okButton: 'Add' });
        if (text) await addFromText(text);
    });
    anchor.after(btn);
}

function registerCommand() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    if (!SlashCommandParser?.addCommandObject) return;
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'vellum',
        helpString: 'Add a character, lorebook or persona from a Vellum link. Example: <code>/vellum https://vellum.thecentralempire.com/c/123</code>',
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'Vellum link(s)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        })],
        callback: async (_args, value) => String(await addFromText(String(value ?? ''))),
    }));
}

jQuery(() => {
    settings();
    mountPanel();
    mountCharacterButton();
    registerCommand();
});
