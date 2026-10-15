"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { StyleSwatch, ThemeSwatch } from "@/components/theme-swatch";
import { Check, Plus } from "@/components/ui/icons";
import { useTheme } from "@/components/use-theme";
import { lookupThemeAction, shareThemeAction, type LookupResult, type ShareResult } from "./actions";
import {
  contrast,
  isHex,
  normalizeCode,
  PRESET_IDS,
  serializeTheme,
  SLOTS,
  STYLE_IDS,
  STYLE_KEYS,
  STYLE_OPTIONS,
  STYLES,
  styleId,
  TEXT_SLOTS,
  THEMES,
  type Chosen,
  type Palette,
  type Slot,
  type Style,
  type Theme,
} from "@/lib/theme";

/** A theme being edited: the name it was saved under (null for a new one) and its working copy. */
interface Draft {
  original: string | null;
  name: string;
  palette: Palette;
  style: Style;
}

/** A note beside the thing it is about, with an optional way back. */
interface Note {
  tone: "good" | "bad";
  text: string;
  undo?: () => void;
}

const sectionTitle = "text-xs font-medium tracking-wide text-ink-3 uppercase";

export function ThemeStudio() {
  const { chosen, choose, preview, endPreview, custom, saveCustom } = useTheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  // While editing, the whole page previews the draft; leaving the editor puts the chosen theme back.
  const editing = draft !== null;
  useEffect(() => {
    if (draft) preview(draft.palette, draft.style);
  }, [draft, preview]);
  useEffect(() => {
    if (!editing) endPreview();
  }, [editing, endPreview]);

  const codes = useShareCodes(custom, saveCustom);

  function restore(before: { list: Theme[]; chosen: Chosen }) {
    saveCustom(before.list);
    choose(before.chosen);
    setNote(null);
  }

  /** Add a theme someone shared and switch to it; one you already have is simply switched to. */
  function add(theme: Theme) {
    const same = custom.find((t) => (theme.code && t.code === theme.code) || serializeTheme(t) === serializeTheme(theme));
    if (same) {
      choose({ colours: `custom:${same.name}`, palette: same.palette, style: same.style });
      return setNote({ tone: "good", text: `You already have “${same.name}”. Switched to it.` });
    }
    const name = uniqueName(theme.name, custom);
    // A renamed theme is a different theme, so it gets its own code.
    const saved: Theme = name === theme.name ? theme : { name, palette: theme.palette, style: theme.style };
    const before = { list: custom, chosen };
    saveCustom([...custom, saved]);
    choose({ colours: `custom:${name}`, palette: saved.palette, style: saved.style });
    setNote({
      tone: "good",
      text:
        name === theme.name
          ? `Added “${name}” and switched to it.`
          : `Added it as “${name}”, since you already have a different theme called “${theme.name}”. Switched to it.`,
      undo: () => restore(before),
    });
  }

  function save() {
    if (!draft) return;
    const name = draft.name.trim().replace(/\s+/g, " ");
    if (!name) return setNote({ tone: "bad", text: "Give the theme a name first." });
    const old = custom.find((t) => t.name === draft.original);
    const unchanged = old && serializeTheme(old) === serializeTheme({ name, palette: draft.palette, style: draft.style });
    const theme: Theme = { name, palette: draft.palette, style: draft.style, code: unchanged ? old.code : undefined };
    const clash = custom.some((t) => t.name === name && t.name !== draft.original);
    const list = custom.filter((t) => t.name !== draft.original && t.name !== name);
    const at = draft.original ? custom.findIndex((t) => t.name === draft.original) : -1;
    list.splice(at >= 0 ? Math.min(at, list.length) : list.length, 0, theme);
    const before = { list: custom, chosen };
    saveCustom(list);
    choose({ colours: `custom:${name}`, palette: theme.palette, style: theme.style });
    setDraft(null);
    setNote({
      tone: "good",
      text: clash
        ? `Saved “${name}”, replacing your earlier theme of that name.`
        : old?.code && !unchanged
          ? `Saved “${name}”. It gets a new code, since it changed; ${old.code} still shows the old version.`
          : `Saved “${name}” and switched to it.`,
      undo: () => restore(before),
    });
  }

  function remove(t: Theme) {
    const before = { list: custom, chosen };
    saveCustom(custom.filter((x) => x.name !== t.name));
    if (chosen.colours === `custom:${t.name}`) choose({ colours: "preset:slate", palette: THEMES.slate.palette });
    setNote({ tone: "good", text: `Deleted “${t.name}”.`, undo: () => restore(before) });
  }

  const edit = (t: Theme) => {
    setNote(null);
    setDraft({ original: t.name, name: t.name, palette: { ...t.palette }, style: { ...t.style } });
  };

  const currentName =
    custom.find((t) => `custom:${t.name}` === chosen.colours)?.name ??
    THEMES[chosen.colours.slice("preset:".length) as keyof typeof THEMES]?.name ??
    "Theme";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 content-start gap-6">
        <section className="panel p-5" aria-labelledby="colours">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="colours" className={sectionTitle}>
              Colours
            </h2>
            <span className="text-xs text-ink-3">Changes colours only; your layout stays.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {PRESET_IDS.map((id) => (
              <Card
                key={id}
                name={THEMES[id].name}
                picture={<ThemeSwatch palette={THEMES[id].palette} className="aspect-[16/10] w-full" />}
                selected={!draft && chosen.colours === `preset:${id}`}
                note={id === "slate" ? "Default" : undefined}
                onClick={() => {
                  setDraft(null);
                  choose({ colours: `preset:${id}`, palette: THEMES[id].palette });
                }}
              />
            ))}
          </div>
        </section>

        <section className="panel p-5" aria-labelledby="layouts">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="layouts" className={sectionTitle}>
              Layout
            </h2>
            <span className="text-xs text-ink-3">Changes the structure only; your colours stay.</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STYLE_IDS.map((id) => (
              <Card
                key={id}
                name={STYLES[id].name}
                description={STYLES[id].description}
                picture={<StyleSwatch style={STYLES[id].style} className="aspect-[16/10] w-full" />}
                selected={!draft && styleId(chosen.style) === id}
                note={id === "classic" ? "Default" : undefined}
                onClick={() => {
                  setDraft(null);
                  choose({ style: STYLES[id].style });
                }}
              />
            ))}
          </div>
        </section>

        <section className="panel p-5" aria-labelledby="yours">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 id="yours" className={sectionTitle}>
              Your themes
            </h2>
            <button
              type="button"
              className="btn btn-ghost h-8 px-3"
              disabled={editing}
              onClick={() => {
                setNote(null);
                setDraft({
                  original: null,
                  name: uniqueName(`My ${currentName}`, custom),
                  palette: { ...chosen.palette },
                  style: { ...chosen.style },
                });
              }}
            >
              <Plus size={14} />
              New theme
            </button>
          </div>
          <p className="mb-4 text-sm text-ink-3">
            Each theme you save gets a code. Give someone the code, or its link, and they can add the theme here.
          </p>

          <CodeLookup disabled={editing} onAdd={add} />

          {note ? <NoteLine note={note} /> : null}

          {custom.length ? (
            <ul className="mt-4 grid gap-2">
              {custom.map((t) => {
                const inUse = !draft && chosen.colours === `custom:${t.name}`;
                const sid = styleId(t.style);
                return (
                  <li
                    key={t.name}
                    className="grid gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <ThemeSwatch palette={t.palette} className="h-10 w-16" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate font-medium">{t.name}</span>
                        {inUse ? <span className="text-xs text-accent">In use</span> : null}
                      </div>
                      <div className="text-xs text-ink-3">
                        {sid
                          ? `${STYLES[sid].name} layout`
                          : `${t.style.layout === "directory" ? "Directory" : "Classic"} layout, adjusted`}
                      </div>
                      <ShareCode theme={t} status={codes.status(t)} onRetry={() => codes.retry(t)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {inUse ? null : (
                        <button
                          type="button"
                          className="btn btn-ghost h-8 px-3"
                          onClick={() => {
                            setDraft(null);
                            choose({ colours: `custom:${t.name}`, palette: t.palette, style: t.style });
                          }}
                        >
                          Use
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost h-8 px-3" onClick={() => edit(t)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost h-8 px-3 hover:text-bad" onClick={() => remove(t)}>
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">None saved yet. Press New theme to start from what you&apos;re using now.</p>
          )}
        </section>

        {draft ? <Editor draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} /> : null}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <Preview editing={editing} />
      </aside>
    </div>
  );
}

function uniqueName(name: string, list: Theme[]) {
  const taken = new Set(list.map((t) => t.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
}

type CodeStatus = "ready" | "pending" | { error: string };

/**
 * Gives every saved theme without a code its code, one at a time, and remembers it with the theme.
 * Failures are shown on the theme with a retry, never retried in a loop.
 */
function useShareCodes(custom: Theme[], saveCustom: (list: Theme[]) => void) {
  const [failed, setFailed] = useState<Record<string, string>>({});
  const inFlight = useRef<string | null>(null);
  const key = (t: Theme) => serializeTheme(t);
  const next = custom.find((t) => !t.code && !failed[key(t)]);

  // Reads the list as it is when the code arrives, which may differ from when it was asked for.
  const done = useEffectEvent((k: string, r: ShareResult) => {
    inFlight.current = null;
    if ("error" in r) return setFailed((f) => ({ ...f, [k]: r.error }));
    saveCustom(custom.map((x) => (key(x) === k && !x.code ? { ...x, code: r.code } : x)));
  });

  useEffect(() => {
    if (!next || inFlight.current) return;
    const k = key(next);
    inFlight.current = k;
    shareThemeAction(k).then(
      (r) => done(k, r),
      () => done(k, { error: "The server couldn't be reached." }),
    );
  }, [next]);

  return {
    status: (t: Theme): CodeStatus => (t.code ? "ready" : failed[key(t)] ? { error: failed[key(t)] } : "pending"),
    retry: (t: Theme) =>
      setFailed((f) => {
        const rest = { ...f };
        delete rest[key(t)];
        return rest;
      }),
  };
}

/** A theme's code, big enough to read out, with buttons that say "Copied" when they've copied. */
function ShareCode({ theme, status, onRetry }: { theme: Theme; status: CodeStatus; onRetry: () => void }) {
  if (status === "pending") return <div className="mt-2 text-xs text-ink-3">Getting a share code…</div>;
  if (status !== "ready") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-bad">
        No share code yet: {status.error}
        <button type="button" className="text-accent underline" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  const link = `${window.location.origin}/theme/${theme.code}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-3">Code</span>
      <code className="rounded-md border border-line bg-code px-2 py-1 font-mono text-sm tracking-wide text-ink">{theme.code}</code>
      <CopyButton value={theme.code!} className="btn btn-ghost h-7 px-2.5 text-xs" title="Copy the code">
        Copy code
      </CopyButton>
      <CopyButton value={link} className="btn btn-ghost h-7 px-2.5 text-xs" title={link}>
        Copy link
      </CopyButton>
    </div>
  );
}

/**
 * Type or paste a code (or a share link). Once it looks like a code it's looked up straight away
 * and the theme is shown before anything is added.
 */
function CodeLookup({ disabled, onAdd }: { disabled: boolean; onAdd: (t: Theme) => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ for: string; value: LookupResult } | null>(null);
  const [pending, start] = useTransition();
  const query = text.trim();
  const looksLikeTheme = /^\s*(bytematch|albedo)-theme:/.test(query);
  const ready = !!normalizeCode(query) || looksLikeTheme;
  const shown = result && result.for === query ? result.value : null;

  const look = useEffectEvent((q: string) =>
    start(async () => {
      const value = await lookupThemeAction(q);
      setResult({ for: q, value });
    }),
  );
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => look(query), 250);
    return () => clearTimeout(t);
  }, [query, ready]);

  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <label htmlFor="code" className="mb-1.5 block text-sm text-ink-2">
        Add a theme by its code
      </label>
      <input
        id="code"
        className="field max-w-sm font-mono"
        placeholder="e.g. brave-otter-12"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="none"
        aria-describedby="code-result"
      />
      <div id="code-result" aria-live="polite" className="text-sm">
        {disabled ? <p className="mt-2 text-xs text-ink-3">Finish or cancel the theme you&apos;re editing first.</p> : null}
        {query && !ready && !disabled ? (
          <p className="mt-2 text-xs text-ink-3">Codes are two words and a number, like brave-otter-12.</p>
        ) : null}
        {ready && (pending || !shown) ? <p className="mt-2 text-xs text-ink-3">Looking it up…</p> : null}
        {shown && "error" in shown ? <p className="mt-2 text-bad">{shown.error}</p> : null}
        {shown && "theme" in shown ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
            <ThemeSwatch palette={shown.theme.palette} className="h-10 w-16" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{shown.theme.name}</span>
              <span className="block text-xs text-ink-3">
                {STYLES[styleId(shown.theme.style) ?? "classic"].name} layout
                {shown.theme.code ? ` · ${shown.theme.code}` : looksLikeTheme && query.includes("albedo-theme:") ? " · from Albedo" : ""}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary h-9 px-4"
              onClick={() => {
                onAdd(shown.theme);
                setText("");
              }}
            >
              Add and use
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NoteLine({ note }: { note: Note }) {
  return (
    <p
      role="status"
      className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${note.tone === "good" ? "text-good" : "text-bad"}`}
    >
      {note.tone === "good" ? <Check size={14} /> : null}
      <span>{note.text}</span>
      {note.undo ? (
        <button type="button" className="text-accent underline" onClick={note.undo}>
          Undo
        </button>
      ) : null}
    </p>
  );
}

function Card({
  name,
  description,
  picture,
  selected,
  note,
  onClick,
}: {
  name: string;
  description?: string;
  picture: React.ReactNode;
  selected: boolean;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-line bg-surface-2 p-2 text-left transition-colors hover:border-line-strong aria-pressed:border-accent"
    >
      {picture}
      <span className="mt-2 flex items-center gap-1.5 px-0.5 text-sm">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {selected ? <Check size={14} className="shrink-0 text-accent" /> : note ? <span className="text-xs text-ink-3">{note}</span> : null}
      </span>
      {description ? <span className="mt-0.5 px-0.5 text-xs leading-snug text-ink-3">{description}</span> : null}
    </button>
  );
}

function Editor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // Opening the editor brings it into view; it sits below the theme lists.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft.original]);
  const set = (slot: Slot, value: string) => onChange({ ...draft, palette: { ...draft.palette, [slot]: value.toLowerCase() } });
  return (
    <section ref={ref} className="panel scroll-mt-20 p-5" aria-labelledby="editor">
      <h2 id="editor" className={`mb-1 ${sectionTitle}`}>
        {draft.original ? `Editing “${draft.original}”` : "New theme"}
      </h2>
      <p className="mb-4 text-sm text-ink-3">
        The whole page previews your changes until you save or cancel. Project pages show a new layout once it&apos;s saved.
      </p>
      <label className="mb-5 block max-w-sm">
        <span className="mb-1.5 block text-sm text-ink-2">Name</span>
        <input className="field" value={draft.name} maxLength={40} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </label>

      <h3 className="mb-3 text-sm font-medium">Layout and style</h3>
      <div className="mb-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {STYLE_KEYS.map((k) => (
          <div key={k}>
            <div className="mb-1.5 text-sm text-ink-2">{STYLE_OPTIONS[k].label}</div>
            <div className="segmented" role="group" aria-label={STYLE_OPTIONS[k].label}>
              {STYLE_OPTIONS[k].options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={draft.style[k] === o.value}
                  onClick={() => onChange({ ...draft, style: { ...draft.style, [k]: o.value } })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className="mb-3 text-sm font-medium">Colours</h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {SLOTS.map(({ slot, label, role }) => (
          <SlotField key={slot} slot={slot} label={label} role={role} palette={draft.palette} onChange={(v) => set(slot, v)} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onSave}>
          Save and use
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function SlotField({
  slot,
  label,
  role,
  palette,
  onChange,
}: {
  slot: Slot;
  label: string;
  role: string;
  palette: Palette;
  onChange: (v: string) => void;
}) {
  const value = palette[slot];
  // The typed text, kept apart from the palette so a half-typed colour isn't rejected mid-word.
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  // Text colours are checked against the surface they sit on; the label says so, not just a colour.
  const ratio = TEXT_SLOTS.includes(slot) ? Math.min(contrast(value, palette.surface), contrast(value, palette.bg)) : null;
  const id = `slot-${slot}`;
  return (
    <div className="flex items-start gap-3">
      <input
        type="color"
        aria-label={`${label} colour`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-6 size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface-2 p-1"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm text-ink-2">
          {label}
          {ratio !== null ? (
            <span className={`font-mono text-xs ${ratio < 4.5 ? "text-warn" : "text-ink-3"}`}>
              {ratio < 4.5 ? "Low contrast " : ""}
              {ratio.toFixed(1)}:1
            </span>
          ) : null}
        </label>
        <input
          id={id}
          className={`field mt-1 h-9 font-mono text-xs ${isHex(text) ? "" : "border-bad"}`}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const t = e.target.value.trim();
            setText(t);
            if (isHex(t)) onChange(t.toLowerCase());
          }}
        />
        <p className="mt-1 text-xs text-ink-3">{role}</p>
      </div>
    </div>
  );
}

/** A sample of the site's parts in the live theme, so a palette can be judged before it's saved. */
function Preview({ editing }: { editing: boolean }) {
  const tiles = [100, 100, 80, 35, 0, 100, 60, 0, 100, 15, 0, 100];
  return (
    <div className="panel grid gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitle}>Preview</h2>
        {editing ? <span className="text-xs text-accent">Editing</span> : null}
      </div>
      <div>
        <div className="font-mono text-xs text-ink-3">owner/project</div>
        <div className="mt-0.5 text-lg font-semibold">A decompilation</div>
        <p className="mt-1 text-sm text-ink-2">
          Secondary text with <a className="text-accent underline">a link</a>.
        </p>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-ink-3">
          <span>Code</span>
          <span className="font-mono">
            <span className="text-ink">72.40%</span> matched
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-track">
          <span className="bg-done" style={{ width: "58%" }} />
          <span style={{ width: "14%", background: "repeating-linear-gradient(135deg, var(--done) 0 7px, var(--done-deep) 7px 14px)" }} />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1" aria-hidden>
        {tiles.map((m, i) => (
          <span
            key={i}
            className="aspect-square rounded-[3px]"
            style={{
              background:
                m >= 100 ? "var(--tile-done)" : m <= 0 ? "var(--idle)" : `color-mix(in srgb, var(--tile-high) ${m}%, var(--tile-low))`,
            }}
          />
        ))}
      </div>
      <div className="flex items-end gap-1" aria-hidden>
        {[30, 42, 48, 61, 66, 72].map((v, i) => (
          <span key={i} className="flex flex-1 flex-col justify-end gap-0.5" style={{ height: 48 }}>
            <span className="rounded-t-sm bg-series-2" style={{ height: `${v * 0.4}%` }} />
            <span className="rounded-t-sm bg-series-1" style={{ height: `${v * 0.6}%` }} />
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-good">+12 matched</span>
        <span className="text-bad">−3 regressed</span>
        <span className="text-warn">Sync paused</span>
      </div>
      <input className="field" placeholder="Filter units" aria-label="Sample field" />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1">
          Primary
        </button>
        <button type="button" className="btn btn-ghost flex-1">
          Secondary
        </button>
      </div>
    </div>
  );
}
