"use client";

import { AlertTriangle, Apple, Crop, Languages, Palette, Play, Settings2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import type { GlobalSettings } from "@/utils/jobs";
import { LOCALE_LABEL, PLAY_TABLET_IDS, PRESETS, STORE_LABEL, setPlayTablets, type Locale, type Store } from "@/utils/presets";
import type { ScaleMode } from "@/utils/canvasResizer";

const STORE_ICON: Record<Store, React.ReactNode> = {
  app_store: <Apple className="size-4" />,
  play_store: <Play className="size-4" />,
};

const MATTE_SWATCHES = ["#FFFFFF", "#000000", "#F4F4F5", "#0F172A"];

export const SCALE_OPTIONS: { value: ScaleMode; label: string; title: string }[] = [
  { value: "fit", label: "Fit", title: "Letterbox — no cropping, fills gaps with a background" },
  { value: "fill", label: "Fill", title: "Smart crop to the exact size" },
  { value: "stretch", label: "Stretch", title: "Distort to the exact size" },
];

function toggle<T>(set: Set<T>, v: T, on: boolean) {
  const next = new Set(set);
  if (on) next.add(v);
  else next.delete(v);
  return next;
}

export function PresetSelector({
  settings,
  onChange,
}: {
  settings: GlobalSettings;
  onChange: (next: GlobalSettings) => void;
}) {
  const set = <K extends keyof GlobalSettings>(k: K, v: GlobalSettings[K]) => onChange({ ...settings, [k]: v });
  const hexValid = /^#[0-9a-f]{6}$/i.test(settings.matte);
  const playTabletsOn = PLAY_TABLET_IDS.some((id) => settings.presets.has(id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4" /> Export presets
        </CardTitle>
        <CardDescription>Applies to every asset unless overridden per image.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Automation */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" /> Automation
          </h3>
          <Row label="Auto-detect device, type & locale">
            <Switch checked={settings.autoDetect} onCheckedChange={(v) => set("autoDetect", v)} />
          </Row>
          <Row label="Auto-generate outputs">
            <Switch checked={settings.autoGenerate} onCheckedChange={(v) => set("autoGenerate", v)} />
          </Row>
          <p className="text-xs text-muted-foreground">
            Detection uses pixel size (exact device resolutions, then aspect ratio), file name and file size. Outputs
            re-render automatically when you change settings.
          </p>
        </section>

        <Separator />

        {/* Platforms + presets */}
        {(["app_store", "play_store"] as Store[]).map((store) => {
          const storeOn = settings.stores.has(store);
          return (
            <section key={store} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`store-${store}`} className="flex items-center gap-2 font-semibold">
                  {STORE_ICON[store]} {STORE_LABEL[store]}
                </Label>
                <Switch
                  id={`store-${store}`}
                  checked={storeOn}
                  onCheckedChange={(v) => set("stores", toggle(settings.stores, store, v))}
                />
              </div>
              {store === "play_store" && (
                <div
                  className={cn(
                    "space-y-1 rounded-lg border bg-muted/30 px-3 py-2",
                    !storeOn && "pointer-events-none opacity-40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="play-tablets" className="text-sm font-medium">
                      Android tablet screenshots
                    </Label>
                    <Switch
                      id="play-tablets"
                      checked={playTabletsOn}
                      onCheckedChange={(v) => set("presets", setPlayTablets(settings.presets, v))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional in Play Console: phone screenshots alone are enough to publish. Keep this on if your app
                    supports tablets, so large-screen devices show tablet screenshots.
                  </p>
                </div>
              )}
              <ul className={cn("space-y-1", !storeOn && "pointer-events-none opacity-40")}>
                {PRESETS.filter((p) => p.store === store && (store !== "play_store" || playTabletsOn || p.deviceClass !== "tablet")).map((p) => {
                  const id = `preset-${p.id}`;
                  const s = p.portrait;
                  return (
                    <li key={p.id} className="rounded-md px-2 py-1.5 hover:bg-muted/60">
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          id={id}
                          className="mt-0.5"
                          checked={settings.presets.has(p.id)}
                          onCheckedChange={(v) => set("presets", toggle(settings.presets, p.id, !!v))}
                        />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                            <span className="font-medium">{p.label}</span>
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {s.w}×{s.h}
                              {!p.landscapeOnly && " ⇄"}
                            </span>
                          </span>
                          {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                          {p.warning && (
                            <span className="mt-0.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="mt-px size-3 shrink-0" /> {p.warning}
                            </span>
                          )}
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <Separator />

        {/* Locales */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Languages className="size-4" /> Locales to export
          </h3>
          <div className="flex gap-4">
            {(["en", "th"] as Locale[]).map((l) => (
              <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={settings.locales.has(l)}
                  onCheckedChange={(v) => set("locales", toggle(settings.locales, l, !!v))}
                />
                <span>
                  {LOCALE_LABEL[l]} <span className="font-mono text-xs text-muted-foreground">({l})</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <Separator />

        {/* Scaling */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Crop className="size-4" /> Scaling
          </h3>
          <Row label="Screenshots">
            <Segmented size="sm" value={settings.mode} options={SCALE_OPTIONS} onChange={(v) => set("mode", v)} />
          </Row>
          <Row label="Feature graphic">
            <Segmented
              size="sm"
              value={settings.featureMode}
              options={SCALE_OPTIONS}
              onChange={(v) => set("featureMode", v)}
            />
          </Row>
          {(settings.mode === "stretch" || settings.featureMode === "stretch") && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              Stretch distorts UI and text. Apple and Google may reject screenshots that misrepresent the app.
            </p>
          )}
          <Row label="Letterbox fill">
            <Segmented
              size="sm"
              value={settings.backdrop}
              options={[
                { value: "blur", label: "Blurred" },
                { value: "solid", label: "Solid" },
              ]}
              onChange={(v) => set("backdrop", v)}
            />
          </Row>
          <Row label={`Fit padding · ${Math.round(settings.padding * 100)}%`}>
            <Slider
              className="w-32"
              min={0}
              max={0.15}
              step={0.01}
              value={settings.padding}
              onValueChange={(v) => set("padding", Array.isArray(v) ? v[0] : v)}
            />
          </Row>
          <Row label="Smart crop focus">
            <Switch checked={settings.smartCrop} onCheckedChange={(v) => set("smartCrop", v)} />
          </Row>
        </section>

        <Separator />

        {/* Output */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="size-4" /> Output
          </h3>
          <Row label="Format">
            <Segmented
              size="sm"
              value={settings.format}
              options={[
                { value: "png", label: "PNG 24-bit" },
                { value: "jpeg", label: "JPEG" },
              ]}
              onChange={(v) => set("format", v)}
            />
          </Row>
          {settings.format === "jpeg" && (
            <Row label={`Quality · ${Math.round(settings.quality * 100)}`}>
              <Slider
                className="w-32"
                min={0.6}
                max={1}
                step={0.01}
                value={settings.quality}
                onValueChange={(v) => set("quality", Array.isArray(v) ? v[0] : v)}
              />
            </Row>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="matte" className="text-xs text-muted-foreground">
              Background / alpha matte
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick matte colour"
                value={hexValid ? settings.matte : "#ffffff"}
                onChange={(e) => set("matte", e.target.value.toUpperCase())}
                className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <Input
                id="matte"
                value={settings.matte}
                onChange={(e) => set("matte", e.target.value)}
                aria-invalid={!hexValid}
                className="h-8 w-24 font-mono text-xs uppercase"
              />
              <div className="flex gap-1">
                {MATTE_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Use ${c}`}
                    onClick={() => set("matte", c)}
                    className={cn(
                      "size-6 rounded-full border shadow-sm",
                      settings.matte.toUpperCase() === c && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Transparent pixels are composited onto this colour so no alpha channel reaches the stores.
            </p>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
