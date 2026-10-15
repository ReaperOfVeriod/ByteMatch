import { ChevronDown } from "./icons";

/**
 * The one dropdown: a native <select> (keyboard, mobile pickers and screen readers for free)
 * with the browser's arrow replaced by a drawn chevron and dark option lists.
 */
export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select {...props} className="field cursor-pointer appearance-none pr-9 [&>option]:bg-surface-2 [&>option]:text-ink" />
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
    </div>
  );
}
