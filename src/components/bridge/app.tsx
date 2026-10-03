import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FolderOpen, Library, Puzzle, Search, ArrowLeftRight } from "lucide-react";
import { SAMPLE_ARCHIVES, SAMPLE_EDITOR, SAMPLE_WORLD, adaptPayload } from "@/lib/vellum/adapt";
import { downloadItem, downloadPack, readDroppedFile } from "@/lib/vellum/files";
import type { Kind, VaultItem } from "@/lib/vellum/types";
import { VAULT } from "@/lib/vellum/vault";

const SHELF_KEY = "vellum-bridge-shelf";

type Tab = "shelf" | "mine" | "adapters" | "plugin";
type KindFilter = Kind | "all";

const TABS: { id: Tab; label: string; icon: typeof Library }[] = [
  { id: "shelf", label: "Vault", icon: Library },
  { id: "mine", label: "Mine", icon: FolderOpen },
  { id: "adapters", label: "Adapters", icon: ArrowLeftRight },
  { id: "plugin", label: "Plugin", icon: Puzzle },
];

function matches(item: VaultItem, query: string, kind: KindFilter, mature: boolean) {
  if (!mature && item.nsfw) return false;
  if (kind !== "all" && item.kind !== kind) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.name, item.creator, item.blurb, item.tags.join(" ")].join(" ").toLowerCase().includes(q);
}

function kindLabel(kind: Kind) {
  if (kind === "lorebook") return "Lorebook";
  if (kind === "persona") return "Persona";
  return "Card";
}

function monogram(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 1)).toUpperCase();
}

export function BridgeApp() {
  const [tab, setTab] = useState<Tab>("shelf");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [mature, setMature] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pack, setPack] = useState<string[]>([]);
  const [mine, setMine] = useState<VaultItem[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHELF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VaultItem[];
        if (Array.isArray(parsed)) setMine(parsed);
      }
    } catch {
      /* a bad shelf should not block the vault */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(SHELF_KEY, JSON.stringify(mine));
  }, [mine, ready]);

  const library = tab === "mine" ? mine : VAULT;
  const visible = useMemo(
    () => library.filter((item) => matches(item, query, kind, mature)),
    [library, query, kind, mature],
  );
  const selected = [...VAULT, ...mine].find((item) => item.id === selectedId) ?? null;
  const packed = [...VAULT, ...mine].filter((item) => pack.includes(item.id));

  function togglePack(id: string) {
    setPack((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function takeFiles(files: File[]) {
    const next: VaultItem[] = [];
    const problems: string[] = [];
    for (const file of files) {
      try {
        const payload = await readDroppedFile(file);
        const items = adaptPayload(payload, file.name.endsWith(".png") ? "editor" : "bundle");
        if (!items.length) problems.push(`${file.name} did not match a known format`);
        next.push(...items);
      } catch (error) {
        problems.push(error instanceof Error ? error.message : `${file.name} failed`);
      }
    }
    if (next.length) {
      setMine((current) => [...next, ...current]);
      setNotice(`${next.length} added to your shelf.`);
      setTab("mine");
      setSelectedId(next[0]?.id ?? null);
    }
    if (problems.length) setNotice(problems.join(" "));
  }

  async function runDownload(items: VaultItem[], packFile: boolean) {
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-6 pb-28">
      <header className="rise">
        <p className="font-display text-sm tracking-widest text-muted uppercase">Vellum</p>
        <h1 className="font-display text-4xl leading-none font-medium tracking-tight text-fg">Bridge</h1>
        <p className="mt-3 max-w-xl text-base leading-normal text-muted">
          Cards, lorebooks, and personas from your Vellum and the central vault, ready for SillyTavern.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-4 border-b border-line" role="tablist" aria-label="Sections">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={
                "inline-flex min-h-11 flex-col items-center justify-center gap-1 border-b-2 px-1 py-2 text-xs font-medium sm:flex-row sm:text-sm " +
                (active ? "border-fg text-fg" : "border-transparent text-muted")
              }
              onClick={() => {
                setTab(item.id);
                setSelectedId(null);
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <main className="mt-5 flex-1">
        {tab === "shelf" || tab === "mine" ? (
          selected ? (
            <Detail
              item={selected}
              packed={pack.includes(selected.id)}
              busy={busy}
              onBack={() => setSelectedId(null)}
              onPack={() => togglePack(selected.id)}
              onDownload={() => void runDownload([selected], false)}
            />
          ) : (
            <ListView
              tab={tab}
              items={visible}
              query={query}
              kind={kind}
              mature={mature}
              total={library.length}
              onQuery={setQuery}
              onKind={setKind}
              onMature={setMature}
              onOpen={setSelectedId}
              onFiles={(files) => void takeFiles(files)}
              onClear={() => {
                setMine([]);
                setPack((current) => current.filter((id) => VAULT.some((item) => item.id === id)));
              }}
            />
          )
        ) : null}

        {tab === "adapters" ? <Adapters onNotice={setNotice} /> : null}
        {tab === "plugin" ? <PluginPanel /> : null}

        {notice ? (
          <p className="mt-4 text-sm text-muted" role="status">
            {notice}
          </p>
        ) : null}
      </main>

      {packed.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-sm text-fg">{packed.length} in the pack</p>
            <div className="flex gap-2">
              <button type="button" className={ghost} onClick={() => setPack([])}>
                Clear
              </button>
              <button type="button" className={solid} disabled={busy} onClick={() => void runDownload(packed, true)}>
                <Download className="size-4" aria-hidden="true" />
                {busy ? "Packing" : "Download pack"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const solid =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-50";
const ghost =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg";

function ListView({
  tab,
  items,
  query,
  kind,
  mature,
  total,
  onQuery,
  onKind,
  onMature,
  onOpen,
  onFiles,
  onClear,
}: {
  tab: "shelf" | "mine";
  items: VaultItem[];
  query: string;
  kind: KindFilter;
  mature: boolean;
  total: number;
  onQuery: (value: string) => void;
  onKind: (value: KindFilter) => void;
  onMature: (value: boolean) => void;
  onOpen: (id: string) => void;
  onFiles: (files: File[]) => void;
  onClear: () => void;
}) {
  return (
    <section className="rise">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {tab === "shelf" ? "Central vault" : "Your shelf"}
        </h2>
        <p className="text-sm text-subtle tabular-nums">{items.length === total ? total : `${items.length} of ${total}`}</p>
      </div>
      <p className="mt-1 text-sm leading-normal text-muted">
        {tab === "shelf"
          ? "The shared shelf. The plugin reads this once the site is published."
          : "Files from the card editor, The Archives, or a bundle. They stay on this device."}
      </p>

      {tab === "mine" ? (
        <label
          className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onFiles([...event.dataTransfer.files]);
          }}
        >
          <span className="text-sm font-medium text-fg">Drop cards, lorebooks, or a bundle</span>
          <span className="mt-1 text-sm text-muted">PNG, JSON, world info, or a Vellum bundle</span>
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json,image/png,.png"
            multiple
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length) onFiles(files);
            }}
          />
        </label>
      ) : null}

      <label className="mt-4 flex items-center gap-2 rounded-md border border-line bg-surface px-3">
        <Search className="size-4 text-subtle" aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Name, tag, creator"
          className="min-h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["card", "Cards"],
            ["lorebook", "Lorebooks"],
            ["persona", "Personas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={kind === id}
            className={
              "min-h-11 rounded-full px-3 text-sm " + (kind === id ? "bg-fg text-bg" : "bg-surface text-muted")
            }
            onClick={() => onKind(id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={mature}
          className={"min-h-11 rounded-full px-3 text-sm " + (mature ? "bg-fg text-bg" : "bg-surface text-muted")}
          onClick={() => onMature(!mature)}
        >
          Mature
        </button>
        {tab === "mine" && total > 0 ? (
          <button type="button" className="min-h-11 rounded-full px-3 text-sm text-muted" onClick={onClear}>
            Clear shelf
          </button>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3 text-left"
              onClick={() => onOpen(item.id)}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-2 font-display text-sm text-fg">
                {monogram(item.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium text-fg">{item.name}</span>
                  <span className="shrink-0 text-xs tracking-wide text-subtle uppercase">{kindLabel(item.kind)}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">{item.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {tab === "mine" ? "Your shelf is empty. Drop a card or a bundle to start." : "Nothing matches."}
        </p>
      ) : null}
    </section>
  );
}

function Detail({
  item,
  packed,
  busy,
  onBack,
  onPack,
  onDownload,
}: {
  item: VaultItem;
  packed: boolean;
  busy: boolean;
  onBack: () => void;
  onPack: () => void;
  onDownload: () => void;
}) {
  const lore =
    item.kind === "lorebook" ? item.book : item.kind === "card" ? item.card?.character_book : item.book;
  return (
    <article className="rise">
      <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>
      <p className="mt-3 text-xs tracking-widest text-subtle uppercase">
        {kindLabel(item.kind)}
        {item.nsfw ? " · Mature" : ""} · {item.creator || "unsigned"}
      </p>
      <h2 className="font-display text-3xl font-medium tracking-tight text-fg">{item.name}</h2>
      <p className="mt-2 text-base leading-normal text-muted">{item.blurb}</p>
      {item.tags.length > 0 ? (
        <p className="mt-3 text-sm text-subtle">{item.tags.join(" · ")}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={solid} disabled={busy} onClick={onDownload}>
          <Download className="size-4" aria-hidden="true" />
          {item.kind === "card" ? "Card PNG" : item.kind === "lorebook" ? "World JSON" : "Persona JSON"}
        </button>
        <button type="button" className={ghost} onClick={onPack}>
          {packed ? "Remove from pack" : "Add to pack"}
        </button>
      </div>
      {item.kind === "persona" ? (
        <p className="mt-3 text-sm leading-normal text-muted">
          SillyTavern cannot import a persona from a file. Put this in a pack and import the bundle with the plugin.
        </p>
      ) : null}

      <div className="mt-6 space-y-4 rounded-xl bg-surface p-4">
        {item.card ? (
          <>
            <Field label="Description" text={item.card.description} />
            <Field label="Personality" text={item.card.personality} />
            <Field label="Scenario" text={item.card.scenario} />
            <Field label="First message" text={item.card.first_mes} />
          </>
        ) : null}
        {item.persona ? (
          <>
            <Field label="Description" text={item.persona.description} />
            <Field label="Attached lorebook" text={item.persona.lorebookName || "None"} />
          </>
        ) : null}
        {lore && lore.entries.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-fg">{lore.name || "Lore"}</h3>
            <ul className="mt-2 space-y-3">
              {lore.entries.map((entry) => (
                <li key={entry.comment + entry.keys.join()}>
                  <p className="text-sm font-medium text-fg">{entry.comment}</p>
                  <p className="text-xs text-subtle">{entry.keys.join(", ") || "Constant"}</p>
                  <p className="mt-1 text-sm leading-normal text-muted">{entry.content}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-fg">{label}</h3>
      <p className="mt-1 text-sm leading-normal whitespace-pre-wrap text-muted">{text}</p>
    </div>
  );
}

function Adapters({ onNotice }: { onNotice: (message: string) => void }) {
  const [raw, setRaw] = useState(JSON.stringify(SAMPLE_ARCHIVES, null, 2));
  const [found, setFound] = useState<VaultItem[] | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
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

  return (
    <section className="rise space-y-5">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Adapters</h2>
        <p className="mt-1 text-sm leading-normal text-muted">
          The plugin speaks one catalog. These three turn the places you already keep material into that catalog.
        </p>
      </div>

      <Adapter
        name="Vault"
        text="This site. Cards, lorebooks, and personas at a stable address the plugin can refresh."
        meta={origin ? `${origin}/api/v1/catalog` : "Catalog address appears when the page is open."}
      />
      <Adapter
        name="Archives"
        text="Flat records from The Archives: name, description, personality, first message, tags, and character_book. A whole export with a cards list works too."
      />
      <Adapter
        name="Editor"
        text="Character card V2 or V3 JSON, a PNG with a chara or ccv3 chunk, SillyTavern world info, and a persona sheet with a name and description."
      />

      <div className="rounded-xl bg-surface p-4">
        <h3 className="text-sm font-medium text-fg">Try a payload</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={ghost} onClick={() => setRaw(JSON.stringify(SAMPLE_ARCHIVES, null, 2))}>
            Archives card
          </button>
          <button type="button" className={ghost} onClick={() => setRaw(JSON.stringify(SAMPLE_WORLD, null, 2))}>
            World info
          </button>
          <button type="button" className={ghost} onClick={() => setRaw(JSON.stringify(SAMPLE_EDITOR, null, 2))}>
            Editor card
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
          className="mt-3 min-h-48 w-full rounded-md border border-line bg-bg p-3 font-mono text-xs leading-normal text-fg outline-none"
          aria-label="JSON to convert"
        />
        <button type="button" className={`${solid} mt-3`} onClick={convert}>
          Convert
        </button>
        {found ? (
          <ul className="mt-4 space-y-2">
            {found.length === 0 ? <li className="text-sm text-muted">No items.</li> : null}
            {found.map((item) => (
              <li key={item.id} className="text-sm text-fg">
                <span className="text-subtle uppercase">{kindLabel(item.kind)}</span> {item.name}
                {item.card?.character_book ? ` · lore ${item.card.character_book.entries.length}` : ""}
                {item.book && item.kind === "lorebook" ? ` · ${item.book.entries.length} entries` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Adapter({ name, text, meta }: { name: string; text: string; meta?: string }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="font-display text-xl font-medium">{name}</h3>
      <p className="mt-1 text-sm leading-normal text-muted">{text}</p>
      {meta ? <p className="mt-2 font-mono text-xs break-all text-subtle">{meta}</p> : null}
    </section>
  );
}

function PluginPanel() {
  const [health, setHealth] = useState<string>("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/v1/health")
      .then((res) => res.json())
      .then((body: { counts?: { card: number; lorebook: number; persona: number } }) => {
        const counts = body.counts;
        if (!counts) return;
        setHealth(`${counts.card} cards, ${counts.lorebook} lorebooks, ${counts.persona} personas live on this vault.`);
      })
      .catch(() => setHealth("The vault catalog is not answering."));
  }, []);

  return (
    <section className="rise">
      <h2 className="font-display text-2xl font-medium tracking-tight">SillyTavern plugin</h2>
      <p className="mt-1 text-sm leading-normal text-muted">
        Install it once. After that, a refresh pulls the vault, or a bundle file brings a private shelf across — including personas, which SillyTavern will not take as a loose file.
      </p>
      {health ? <p className="mt-3 text-sm text-fg">{health}</p> : null}

      <ol className="mt-5 space-y-3 text-sm leading-normal text-muted">
        <li>
          <span className="font-medium text-fg">1. Download the extension.</span> Unzip it and keep the folder name{" "}
          <span className="text-fg">vellum-bridge</span>.
        </li>
        <li>
          <span className="font-medium text-fg">2. Move that folder</span> into{" "}
          <span className="text-fg">SillyTavern/public/scripts/extensions/third-party</span>. Restart SillyTavern.
        </li>
        <li>
          <span className="font-medium text-fg">3. Open Extensions → Vellum Bridge.</span> Paste the vault address
          {origin ? (
            <>
              {" "}
              <span className="font-mono text-xs break-all text-fg">{origin}</span>
            </>
          ) : null}{" "}
          and, if you have one, your own Vellum or Archives address.
        </li>
        <li>
          <span className="font-medium text-fg">4. Or skip the address.</span> Download a pack from this shelf and use
          Import bundle inside the plugin. One file writes cards, worlds, and personas.
        </li>
      </ol>

      <a className={`${solid} mt-5`} href="/api/v1/plugin" download="vellum-bridge.zip">
        <Download className="size-4" aria-hidden="true" />
        Download plugin
      </a>
    </section>
  );
}
