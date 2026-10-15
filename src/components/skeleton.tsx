/** Grey blocks standing in for content while a page loads; they pulse unless motion is reduced. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none ${className}`} />;
}

/** Shown the moment a link is clicked, so a slow page never feels like a click that didn't land. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
