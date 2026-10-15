"use client";

import { useEffect, useState } from "react";
import { Check } from "./ui/icons";

/**
 * Copies a value and says so on the button itself for two seconds, where the eye already is. If the
 * browser refuses, the button says that instead.
 */
export function CopyButton({
  value,
  children,
  className = "btn btn-ghost h-8 px-3",
  title,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
    >
      <span aria-live="polite" className="contents">
        {state === "copied" ? (
          <>
            <Check size={14} className="text-good" />
            Copied
          </>
        ) : state === "failed" ? (
          "Couldn't copy"
        ) : (
          children
        )}
      </span>
    </button>
  );
}
