"use client";

/**
 * A script that runs while the HTML is parsed. React warns about rendering <script> on the client
 * and would never run it there anyway, so the client renders it inert; suppressHydrationWarning
 * covers the type differing between the two.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
