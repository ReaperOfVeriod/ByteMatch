"use client";

import { useRouter } from "next/navigation";
import { Select } from "./ui/select";

/** Switches game version; each version has its own page. */
export function VersionSelect({
  base,
  versions,
  current,
  defaultVersion,
}: {
  base: string;
  versions: string[];
  current: string;
  defaultVersion: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={current}
      onChange={(e) => router.push(e.target.value === defaultVersion ? base : `${base}/${encodeURIComponent(e.target.value)}`)}
      aria-label="Game version"
      className="w-auto min-w-36 [&_select]:h-9 [&_select]:font-mono [&_select]:text-xs"
    >
      {versions.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </Select>
  );
}
