"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeSwatch } from "@/components/theme-swatch";
import { Check, Plus } from "@/components/ui/icons";
import { useThemes } from "@/components/use-theme";
import {
  applyTheme,
  chooseTheme,
  chosenTheme,
  contrast,
  isHex,
  parseTheme,
  PRESET_IDS,
  saveCustomThemes,
  serializeTheme,
  SLOTS,
  TEXT_SLOTS,
  THEMES,
  type Palette,
  type Slot,
  type Theme,
} from "@/lib/theme";

/** A theme being edited: the name it was saved under (null for a new one) and its working copy. */
interface Draft {
  original: string | null;
  name: string;
  palette: Palette;
}

export function ThemeStudio() {
  const { chosenId, chosen, custom } = useThemes();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // While editing, the whole page previews the draft; leaving the editor (or the page) puts the
  // remembered theme back. Read from storage here, not the hook, which is null while hydrating.
  useEffect(() => {
    applyTheme(draft ? draft.palette : (chosenTheme()?.palette ?? null));
  }, [draft]);
  useEffect(() => () => applyTheme(chosenTheme()?.palette ?? null), []);

  const current: Palette = chosen?.palette ?? THEMES.slate.palette;

  function startNew() {
    const base = custom.find((t) => `custom:${t.name}` === chosenId)?.name ?? THEMES[presetOf(chosenId)]?.name ?? "Theme";
    setDraft({ original: null, name: uniqueName(`${base} copy`, custom), palette: { ...current } });
    setMessage(null);
  }

  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setMessage({ tone: "bad", text: "Give the theme a name." });
    const theme: Theme = { name, palette: draft.palette };
    const list = custom.filter((t) => t.name !== draft.original && t.name !== name);
    const at = draft.original ? custom.findIndex((t) => t.name === draft.original) : -1;
    list.splice(at >= 0 ? Math.min(at, list.length) : list.length, 0, theme);
    saveCustomThemes(list);
    chooseTheme(`custom:${name}`, theme.palette);
    setDraft(null);
    setMessage({ tone: "good", text: `Saved “${name}” and switched to it.` });
  }

  function remove(name: string) {
    if (!confirm(`Delete the theme “${name}”?`)) return;
    saveCustomThemes(custom.filter((t) => t.name !== name));
    if (chosenId === `custom:${name}`) chooseTheme("preset:slate", THEMES.slate.palette);
    setMessage({ tone: "good", text: `Deleted “${name}”.` });
  }

  function importPasted() {
    const r = parseTheme(paste);
    if (!r.ok) return setMessage({ tone: "bad", text: r.error });
    setDraft({ original: null, name: uniqueName(r.theme.name, custom), palette: r.theme.palette });
    setPaste("");
    setMessage({ tone: "good", text: `Imported “${r.theme.name}”. Check it below, then save it.` });
  }

  async function copy(theme: Theme) {
    try {
      await navigator.clipboard.writeText(serializeTheme(theme));
      setMessage({ tone: "good", text: `Copied “${theme.name}”. Paste it anywhere to share it.` });
    } catch {
      setMessage({ tone: "bad", text: "The clipboard is not available here." });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 content-start gap-6">
        {message ? (
          <p role="status" className={`text-sm ${message.tone === "good" ? "text-good" : "text-bad"}`}>
            {message.text}
          </p>
        ) : null}

        <section className="panel p-5" aria-labelledby="built-in">
          <h2 id="built-in" className="mb-4 text-xs font-medium tracking-wide text-ink-3 uppercase">
            Built in
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {PRESET_IDS.map((id) => (
              <ThemeCard
                key={id}
                name={THEMES[id].name}
                palette={THEMES[id].palette}
                selected={!draft && chosenId === `preset:${id}`}
                note={id === "slate" ? "Default" : undefined}
                onClick={() => {
                  setDraft(null);
                  chooseTheme(`preset:${id}`, THEMES[id].palette);
                }}
              />
            ))}
          </div>
        </section>

        <section className="panel p-5" aria-labelledby="yours">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="yours" className="text-xs font-medium tracking-wide text-ink-3 uppercase">
              Your themes
            </h2>
            <button type="button" className="btn btn-ghost h-8 px-3" onClick={startNew} disabled={!!draft}>
              <Plus size={14} />
              New from current
            </button>
          </div>
          {custom.length ? (
            <ul className="grid gap-2">
              {custom.map((t) => (
                <li key={t.name} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 p-2.5">
                  <ThemeSwatch palette={t.palette} className="h-9 w-14" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.name}
                    {!draft && chosenId === `custom:${t.name}` ? <span className="ml-2 text-xs text-ink-3">In use</span> : null}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="btn btn-ghost h-8 px-3"
                      onClick={() => {
                        setDraft(null);
                        chooseTheme(`custom:${t.name}`, t.palette);
                      }}
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-8 px-3"
                      onClick={() => setDraft({ original: t.name, name: t.name, palette: { ...t.palette } })}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-ghost h-8 px-3" onClick={() => copy(t)}>
                      Copy
                    </button>
                    <button type="button" className="btn btn-ghost h-8 px-3 hover:text-bad" onClick={() => remove(t.name)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">None yet. Start from the current theme, or paste one below.</p>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <label htmlFor="paste" className="mb-1.5 block text-sm text-ink-2">
              Paste a theme
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="paste"
                className="field font-mono text-xs"
                placeholder="bytematch-theme:1:{…} or albedo-theme:1:{…}"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && paste.trim() && importPasted()}
                spellCheck={false}
              />
              <button type="button" className="btn btn-ghost shrink-0" onClick={importPasted} disabled={!paste.trim() || !!draft}>
                Import
              </button>
            </div>
          </div>
        </section>

        {draft ? (
          <Editor
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={() => {
              setDraft(null);
              setMessage(null);
            }}
            onCopy={() => copy({ name: draft.name.trim() || "Untitled", palette: draft.palette })}
          />
        ) : null}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <Preview editing={!!draft} />
      </aside>
    </div>
  );
}

function presetOf(id: string) {
  return id.slice("preset:".length) as keyof typeof THEMES;
}

function uniqueName(name: string, list: Theme[]) {
  const taken = new Set(list.map((t) => t.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
}

function ThemeCard({
  name,
  palette,
  selected,
  note,
  onClick,
}: {
  name: string;
  palette: Palette;
  selected: boolean;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="group rounded-xl border border-line bg-surface-2 p-2 text-left transition-colors hover:border-line-strong aria-pressed:border-accent"
    >
      <ThemeSwatch palette={palette} className="aspect-[16/10] w-full" />
      <span className="mt-2 flex items-center gap-1.5 px-0.5 text-sm">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {selected ? <Check size={14} className="shrink-0 text-accent" /> : note ? <span className="text-xs text-ink-3">{note}</span> : null}
      </span>
    </button>
  );
}

function Editor({
  draft,
  onChange,
  onSave,
  onCancel,
  onCopy,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onCopy: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // Opening the editor brings it into view; it sits below the theme lists.
  useEffect(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), [draft.original]);
  const set = (slot: Slot, value: string) => onChange({ ...draft, palette: { ...draft.palette, [slot]: value.toLowerCase() } });
  return (
    <section ref={ref} className="panel scroll-mt-20 p-5" aria-labelledby="editor">
      <h2 id="editor" className="mb-1 text-xs font-medium tracking-wide text-ink-3 uppercase">
        {draft.original ? `Editing “${draft.original}”` : "New theme"}
      </h2>
      <p className="mb-4 text-sm text-ink-3">The whole page previews your changes until you save or cancel.</p>
      <label className="mb-4 block max-w-sm">
        <span className="mb-1.5 block text-sm text-ink-2">Name</span>
        <input className="field" value={draft.name} maxLength={40} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </label>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {SLOTS.map(({ slot, label, role }) => (
          <SlotField key={slot} slot={slot} label={label} role={role} palette={draft.palette} onChange={(v) => set(slot, v)} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onSave}>
          Save and use
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCopy}>
          Copy as text
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
            if (isHex(t)) onChange(t);
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
        <h2 className="text-xs font-medium tracking-wide text-ink-3 uppercase">Preview</h2>
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
