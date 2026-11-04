"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  AlertTriangle,
  Apple,
  CheckCircle2,
  ClipboardCopy,
  FileArchive,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  Undo2,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import {
  EMPTY_LISTING,
  FIELDS,
  fixAll,
  lintListing,
  measure,
  type FieldId,
  type FieldSpec,
  type Issue,
  type Listing,
} from "@/utils/listingRules";
import { buildFastlaneZip } from "@/utils/listingExport";
import type { Locale } from "@/utils/presets";

const STORAGE_KEY = "storeshot:listing:v1";

interface Saved {
  drafts: Record<Locale, Listing>;
  company: string;
}

const EMPTY: Saved = { drafts: { en: { ...EMPTY_LISTING }, th: { ...EMPTY_LISTING } }, company: "" };

/** A deliberately messy example that shows most checks. */
const EXAMPLE: Listing = {
  "apple.name": "Penny Budget – FREE for iOS & Android",
  "apple.subtitle": "The #1 budget app 💰",
  "apple.promo": "Apple approved budgeting!!! Download now 🚀",
  "apple.description":
    "<b>Penny</b> helps you plan monthly budgets.<br>Available on iPhone and Android.\n\n• Track spending\n• Beta: shared budgets\n• Works with Google Play subscriptions\n\n“Best budgeting app ever!”",
  "apple.keywords": "budget, Budget, expense, android, tiktok, money, penny, ab",
  "apple.whatsNew": "Bug fixes and performance improvements.",
  "play.title": "💰 #1 BUDGET APP - 50% OFF!!!",
  "play.short": "The best budget planner ever!!! Also on iPhone.",
  "play.full":
    "Budget budget budget. Penny is the budget app for your budget. Plan a budget, track the budget, share the budget, review the budget.\n\n“Life-changing app!”\n★★★★★",
};

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Saved>;
    return {
      company: typeof v.company === "string" ? v.company : "",
      drafts: {
        en: { ...EMPTY_LISTING, ...(v.drafts?.en ?? {}) },
        th: { ...EMPTY_LISTING, ...(v.drafts?.th ?? {}) },
      },
    };
  } catch {
    return EMPTY;
  }
}

const LEVEL_ICON = {
  error: <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />,
  warning: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />,
  info: <Info className="mt-0.5 size-4 shrink-0 text-sky-500" />,
};

export function ListingStudio() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  // Per locale + field undo stacks
  const history = useRef(new Map<string, string[]>());
  const [, bump] = useState(0);

  // Load drafts after mount (localStorage isn't available during static rendering).
  useEffect(() => {
    const v = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
    setSaved(v);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* storage blocked: drafts just won't persist */
    }
  }, [saved, loaded]);

  const listing = saved.drafts[locale];
  const ctx = useMemo(() => ({ company: saved.company }), [saved.company]);
  const issues = useMemo(() => lintListing(listing, ctx), [listing, ctx]);
  const byField = useMemo(() => {
    const m = new Map<FieldId, Issue[]>();
    for (const i of issues) m.set(i.field, [...(m.get(i.field) ?? []), i]);
    return m;
  }, [issues]);
  const otherLocale: Locale = locale === "en" ? "th" : "en";
  const otherIssues = useMemo(() => lintListing(saved.drafts[otherLocale], ctx), [saved.drafts, otherLocale, ctx]);

  const pushHistory = (field: FieldId, prev: string) => {
    const key = `${locale}:${field}`;
    const stack = history.current.get(key) ?? [];
    if (stack.at(-1) !== prev) stack.push(prev);
    history.current.set(key, stack.slice(-30));
  };

  const setField = useCallback(
    (field: FieldId, value: string, { record = false } = {}) => {
      setSaved((s) => {
        const prev = s.drafts[locale][field];
        if (prev === value) return s;
        if (record) pushHistory(field, prev);
        return { ...s, drafts: { ...s.drafts, [locale]: { ...s.drafts[locale], [field]: value } } };
      });
      if (record) bump((n) => n + 1);
    },
    [locale], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const undo = (field: FieldId) => {
    const key = `${locale}:${field}`;
    const stack = history.current.get(key);
    const prev = stack?.pop();
    if (prev === undefined) return;
    setField(field, prev);
    bump((n) => n + 1);
  };

  const applyFix = (i: Issue) => {
    if (!i.fix) return;
    setField(i.field, i.fix(listing[i.field]), { record: true });
  };

  const onFixAll = () => {
    const { listing: next, applied } = fixAll(listing, ctx);
    if (!applied) {
      toast("Nothing left to auto-fix", { description: "Remaining items need a manual edit or are just notes." });
      return;
    }
    for (const f of FIELDS) if (next[f.id] !== listing[f.id]) pushHistory(f.id, listing[f.id]);
    setSaved((s) => ({ ...s, drafts: { ...s.drafts, [locale]: next } }));
    bump((n) => n + 1);
    toast.success(`Applied ${applied} fix${applied === 1 ? "" : "es"}`, { description: "Use Undo on any field to revert." });
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
    }
  };

  const download = async () => {
    try {
      const blob = await buildFastlaneZip(saved.drafts);
      saveAs(blob, `store-listing-text-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      toast.error("Nothing to export", { description: (e as Error).message });
    }
  };

  const copyAppleToPlay = () => {
    const pairs: [FieldId, FieldId][] = [
      ["apple.name", "play.title"],
      ["apple.subtitle", "play.short"],
      ["apple.description", "play.full"],
    ];
    for (const [from, to] of pairs) if (listing[from] && !listing[to]) setField(to, listing[from], { record: true });
    toast("Copied empty Google Play fields from Apple", { description: "Then run the checks; each store has different rules." });
  };

  const count = (list: Issue[], level: Issue["level"], store?: "apple" | "play") =>
    list.filter((i) => i.level === level && (!store || i.field.startsWith(store))).length;
  const hasText = FIELDS.some((f) => listing[f.id]);
  const errorsIn = (l: Locale) => count(l === locale ? issues : otherIssues, "error");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            aria-label="Language"
            value={locale}
            onChange={setLocale}
            options={[
              { value: "en", label: <>English {badge(errorsIn("en"))}</> },
              { value: "th", label: <>ไทย (Thai) {badge(errorsIn("th"))}</> },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyAppleToPlay} disabled={!hasText}>
              <ClipboardCopy /> Fill Play from Apple
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                for (const f of FIELDS) pushHistory(f.id, listing[f.id]);
                setSaved((s) => ({ ...s, drafts: { ...s.drafts, [locale]: { ...EXAMPLE } } }));
                bump((n) => n + 1);
              }}
            >
              <Sparkles /> Try an example
            </Button>
          </div>
        </div>

        <StoreCard
          store="apple"
          title="Apple App Store"
          icon={<Apple className="size-4" />}
          listing={listing}
          byField={byField}
          onChange={(f, v) => setField(f, v)}
          onFix={applyFix}
          onUndo={undo}
          canUndo={(f) => (history.current.get(`${locale}:${f}`)?.length ?? 0) > 0}
          onCopy={copy}
        />
        <StoreCard
          store="play"
          title="Google Play"
          icon={<Play className="size-4" />}
          listing={listing}
          byField={byField}
          onChange={(f, v) => setField(f, v)}
          onFix={applyFix}
          onUndo={undo}
          canUndo={(f) => (history.current.get(`${locale}:${f}`)?.length ?? 0) > 0}
          onCopy={copy}
        />
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-primary/20 bg-gradient-to-b from-primary/[0.04] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="size-4" /> Listing check
            </CardTitle>
            <CardDescription>{locale === "en" ? "English" : "Thai"} text, checked against Apple&apos;s and Google&apos;s rules as you type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["apple", "play"] as const).map((store) => {
              const e = count(issues, "error", store);
              const w = count(issues, "warning", store);
              const n = count(issues, "info", store);
              const filled = FIELDS.some((f) => f.store === store && listing[f.id]);
              return (
                <div key={store} className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {store === "apple" ? <Apple className="size-4" /> : <Play className="size-4" />}
                    {store === "apple" ? "App Store" : "Google Play"}
                  </span>
                  {!filled ? (
                    <span className="text-xs text-muted-foreground">Empty</span>
                  ) : e + w === 0 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Looks good{n ? ` · ${n} note${n === 1 ? "" : "s"}` : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      {e > 0 && <span className="font-medium text-destructive">{e} error{e === 1 ? "" : "s"}</span>}
                      {w > 0 && <span className="font-medium text-amber-700 dark:text-amber-400">{w} warning{w === 1 ? "" : "s"}</span>}
                    </span>
                  )}
                </div>
              );
            })}
            <Button className="w-full" onClick={onFixAll} disabled={!issues.some((i) => i.fix && i.level !== "info")}>
              <Wand2 /> Fix all errors &amp; warnings
            </Button>
            <p className="text-xs text-muted-foreground">
              Fixes remove other-platform mentions, prices and ranking claims, convert HTML, clean keywords and trim to the limit.
              Placeholder text and testimonials need your own edit. Emoji on Apple are allowed, so they&apos;re only removed if you
              click that fix.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs text-muted-foreground">
                Company / developer name (for the keyword check)
              </Label>
              <Input
                id="company"
                value={saved.company}
                onChange={(e) => setSaved((s) => ({ ...s, company: e.target.value }))}
                placeholder="e.g. Acme Labs"
                className="h-8 text-sm"
              />
            </div>

            <Button variant="outline" className="w-full" onClick={download}>
              <FileArchive /> Download fastlane metadata
            </Button>
            <p className="text-xs text-muted-foreground">
              A ZIP with <code className="font-mono">fastlane/metadata/…</code> text files for both languages, ready for{" "}
              <code className="font-mono">deliver</code> and <code className="font-mono">supply</code> in Flutter or React Native projects.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              disabled={!hasText}
              onClick={() => {
                for (const f of FIELDS) pushHistory(f.id, listing[f.id]);
                setSaved((s) => ({ ...s, drafts: { ...s.drafts, [locale]: { ...EMPTY_LISTING } } }));
                bump((n) => n + 1);
              }}
            >
              <RotateCcw /> Clear {locale === "en" ? "English" : "Thai"} text
            </Button>
            <p className="text-xs text-muted-foreground">Drafts are saved in this browser only.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function badge(n: number) {
  return n ? <span className="ml-1 rounded-full bg-destructive/15 px-1.5 text-xs text-destructive tabular-nums">{n}</span> : null;
}

function StoreCard({
  store,
  title,
  icon,
  listing,
  byField,
  onChange,
  onFix,
  onUndo,
  canUndo,
  onCopy,
}: {
  store: "apple" | "play";
  title: string;
  icon: React.ReactNode;
  listing: Listing;
  byField: Map<FieldId, Issue[]>;
  onChange: (f: FieldId, v: string) => void;
  onFix: (i: Issue) => void;
  onUndo: (f: FieldId) => void;
  canUndo: (f: FieldId) => boolean;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {FIELDS.filter((f) => f.store === store).map((f) => (
          <FieldEditor
            key={f.id}
            spec={f}
            value={listing[f.id]}
            issues={byField.get(f.id) ?? []}
            onChange={(v) => onChange(f.id, v)}
            onFix={onFix}
            onUndo={() => onUndo(f.id)}
            canUndo={canUndo(f.id)}
            onCopy={() => onCopy(listing[f.id], `${title} ${f.label}`)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function FieldEditor({
  spec,
  value,
  issues,
  onChange,
  onFix,
  onUndo,
  canUndo,
  onCopy,
}: {
  spec: FieldSpec;
  value: string;
  issues: Issue[];
  onChange: (v: string) => void;
  onFix: (i: Issue) => void;
  onUndo: () => void;
  canUndo: boolean;
  onCopy: () => void;
}) {
  const n = measure(value, spec.unit);
  const over = n > spec.limit;
  const id = `field-${spec.id}`;
  const worst = issues.some((i) => i.level === "error") ? "error" : issues.some((i) => i.level === "warning") ? "warning" : null;
  const inputClass = cn(
    "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    worst === "error" && "border-destructive/60",
    worst === "warning" && "border-amber-500/60",
  );
  return (
    <div className="space-y-1.5" data-field={spec.id}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label htmlFor={id} className="font-medium">
            {spec.label}
          </Label>
          <p className="text-xs text-muted-foreground">{spec.help}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn("font-mono text-xs tabular-nums", over ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {n}/{spec.limit}
            {spec.unit === "bytes" ? " bytes" : ""}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onUndo} disabled={!canUndo} aria-label={`Undo last fix in ${spec.label}`} title="Undo last fix">
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onCopy} disabled={!value} aria-label={`Copy ${spec.label}`} title="Copy">
            <ClipboardCopy />
          </Button>
        </div>
      </div>
      {spec.multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={spec.limit > 1000 ? 7 : 3}
          className={cn(inputClass, "resize-y leading-relaxed")}
          spellCheck
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} spellCheck />
      )}
      {issues.length > 0 && (
        <ul className="space-y-1.5">
          {issues.map((i) => (
            <li key={i.id} className="flex gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm" data-level={i.level}>
              {LEVEL_ICON[i.level]}
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  {i.message}{" "}
                  <span className="rounded bg-background px-1 py-px font-mono text-xs text-muted-foreground">{i.rule}</span>
                </p>
                {i.match && <p className="mt-0.5 truncate text-xs text-muted-foreground">Found: “{i.match}”</p>}
              </div>
              {i.fix && (
                <Button variant="outline" size="xs" onClick={() => onFix(i)} className="shrink-0 self-start">
                  {i.fixLabel ?? "Fix"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
