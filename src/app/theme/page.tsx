import { browseMetadata } from "@/lib/seo";
import { ThemeStudio } from "./studio";

export function generateMetadata() {
  return browseMetadata("Theme", "Choose how the site looks, or make, share and import your own colour theme.", "/theme");
}

export default function ThemePage() {
  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Theme</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Pick a built-in theme or make your own from thirteen colours; everything else on the site is mixed from them. Themes are kept in
          this browser. Share one by copying its text, and paste a friend&apos;s (or an Albedo theme) to import it.
        </p>
      </div>
      <ThemeStudio />
    </div>
  );
}
