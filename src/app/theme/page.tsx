import { browseMetadata } from "@/lib/seo";
import { ThemeStudio } from "./studio";

export function generateMetadata() {
  return browseMetadata("Theme", "Choose the site\u2019s colours and layout, or make, share and import your own theme.", "/theme");
}

export default function ThemePage() {
  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Theme</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Pick colours and a layout separately, or save both together as your own theme. Your choice is remembered in this browser. To share
          a theme, copy it as one line of text; to use someone else&apos;s, copy it and press Paste theme.
        </p>
      </div>
      <ThemeStudio />
    </div>
  );
}
