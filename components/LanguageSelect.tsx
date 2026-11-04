"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "@/utils/languages";

/** Every App Store / Google Play language, English first, the rest alphabetical. */
const ORDERED = [
  ...LANGUAGES.filter((l) => l.id.startsWith("en-")),
  ...LANGUAGES.filter((l) => !l.id.startsWith("en-")).sort((a, b) => a.name.localeCompare(b.name)),
];

export function LanguageSelect({
  value,
  onChange,
  className,
  size = "default",
  exclude,
  "aria-label": ariaLabel = "Language",
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "default";
  /** Ids to leave out (e.g. languages already added) */
  exclude?: string[];
  "aria-label"?: string;
}) {
  const known = ORDERED.some((l) => l.id === value);
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <Languages className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-lg border bg-muted/50 pr-7 pl-7 font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
          size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
        )}
      >
        {!known && value && <option value={value}>{value}</option>}
        {ORDERED.filter((l) => l.id === value || !exclude?.includes(l.id)).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.native !== l.name && !l.native.startsWith("English") ? ` · ${l.native}` : ""}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">▾</span>
    </label>
  );
}
