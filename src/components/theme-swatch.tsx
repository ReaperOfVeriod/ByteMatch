import type { Palette } from "@/lib/theme";

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
