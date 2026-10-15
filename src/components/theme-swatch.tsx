import type { Palette, Style } from "@/lib/theme";

/**
 * A small picture of a palette: its background, a surface with a line, text, the accent and the
 * two progress colours. Drawn from the palette it is given, not the live theme, so every option
 * in a list shows itself.
 */
export function ThemeSwatch({ palette, className = "" }: { palette: Palette; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 overflow-hidden rounded-md ${className}`}
      style={{ background: palette.bg, boxShadow: `inset 0 0 0 1px ${palette.line}` }}
    >
      <span
        className="absolute inset-x-[18%] top-[22%] bottom-[22%] rounded-[3px]"
        style={{ background: palette.surface, boxShadow: `inset 0 0 0 1px ${palette.line}` }}
      >
        <span className="absolute top-[22%] left-[14%] h-[14%] w-[44%] rounded-full" style={{ background: palette.text }} />
        <span className="absolute top-[48%] left-[14%] h-[12%] w-[30%] rounded-full" style={{ background: palette.accent }} />
        <span
          className="absolute bottom-[16%] left-[14%] h-[12%] w-[72%] overflow-hidden rounded-full"
          style={{ background: palette.line }}
        >
          <span className="absolute inset-y-0 left-0 w-[55%]" style={{ background: palette.done }} />
          <span className="absolute inset-y-0 left-[55%] w-[20%]" style={{ background: palette.partial }} />
        </span>
      </span>
    </span>
  );
}

/**
 * A small wireframe of a style in the live theme's colours: Classic shows rounded panels beside a
 * sidebar, Directory a header bar over full-width rows. Corners and depth follow the style.
 */
export function StyleSwatch({ style, palette, className = "" }: { style: Style; palette?: Palette; className?: string }) {
  // The live theme's colours, unless it's showing some other theme's.
  const c = (slot: "bg" | "surface" | "line" | "accent") => (palette ? palette[slot] : `var(--${slot})`);
  const r = style.corners === "round" ? 3 : style.corners === "soft" ? 1.5 : 0.5;
  const shadow = style.depth === "raised" ? "0 1px 2px rgb(0 0 0 / 0.35)" : "none";
  const box = (extra: React.CSSProperties) => (
    <span
      className="absolute"
      style={{ background: c("surface"), boxShadow: `inset 0 0 0 1px ${c("line")}, ${shadow}`, borderRadius: r, ...extra }}
    />
  );
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 overflow-hidden rounded-md ${className}`}
      style={{ background: c("bg"), boxShadow: `inset 0 0 0 1px ${c("line")}` }}
    >
      {style.layout === "classic" ? (
        <>
          {box({ left: "10%", top: "16%", width: "52%", height: "68%" })}
          {box({ left: "68%", top: "16%", width: "22%", height: "68%" })}
          <span className="absolute h-[10%] w-[30%] rounded-full" style={{ left: "16%", top: "30%", background: c("accent") }} />
        </>
      ) : (
        <>
          <span
            className="absolute inset-x-0 top-0 h-[20%]"
            style={{ background: c("surface"), boxShadow: `inset 0 -1px 0 ${c("line")}` }}
          />
          <span className="absolute h-[3px] w-[16%]" style={{ left: "10%", top: "17%", background: c("accent") }} />
          {box({ left: "10%", top: "32%", width: "80%", height: "24%" })}
          {box({ left: "10%", top: "60%", width: "80%", height: "24%" })}
        </>
      )}
    </span>
  );
}
