"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { AlertTriangle, Apple, FileArchive, FolderTree, Loader2, Play, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import {
  SAFE_ZONE,
  drawIcon,
  exportIcons,
  layoutRoots,
  loadIconSource,
  planIcons,
  type Framework,
  type IconSettings,
  type IconSource,
} from "@/utils/iconGenerator";

const DEFAULTS: IconSettings = {
  framework: "flutter",
  rnAppName: "MyApp",
  iosMode: "single",
  background: "#FFFFFF",
  iosScale: 1,
  androidScale: 0.72,
  monochrome: true,
  darkVariants: false,
  darkBackground: "#111111",
};

const FRAMEWORKS: { value: Framework; label: string }[] = [
  { value: "flutter", label: "Flutter" },
  { value: "react-native", label: "React Native" },
  { value: "expo", label: "Expo" },
  { value: "native", label: "Native" },
];

export function IconGenerator() {
  const [src, setSrc] = useState<IconSource | null>(null);
  const [name, setName] = useState("");
  const [s, setS] = useState<IconSettings>(DEFAULTS);
  const [progress, setProgress] = useState<number | null>(null);
  const set = <K extends keyof IconSettings>(k: K, v: IconSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const onFile = async (file: File) => {
    try {
      const loaded = await loadIconSource(file);
      src?.bitmap.close();
      setSrc(loaded);
      setName(file.name);
      // Auto-configure from the source: transparent logo vs full-bleed artwork.
      setS((p) => ({
        ...p,
        background: loaded.hasAlpha ? "#FFFFFF" : loaded.edgeColor,
        iosScale: loaded.hasAlpha ? 0.78 : 1,
        androidScale: loaded.hasAlpha ? SAFE_ZONE : 0.72,
      }));
      if (loaded.width !== loaded.height) toast.warning("Source isn't square", { description: "It will be centred and letterboxed." });
    } catch (e) {
      toast.error("Couldn't load icon", { description: (e as Error).message });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => f[0] && onFile(f[0]),
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] },
    multiple: false,
    maxSize: 30 * 1048576,
  });

  const plan = useMemo(() => (src ? planIcons(s, src) : null), [s, src]);
  const roots = layoutRoots(s);
  const hexOk = /^#[0-9a-f]{6}$/i.test(s.background);

  const generate = async () => {
    if (!src || !hexOk) return;
    setProgress(0);
    try {
      const r = await exportIcons(src, s, (d, t) => setProgress((d / t) * 100));
      toast.success("Icon pack ready", {
        description: `${r.count} files · ${(r.bytes / 1024).toFixed(0)} KB${r.playBytes > 1024 * 1024 ? " · Play icon is over 1024 KB" : ""}`,
      });
    } catch (e) {
      toast.error("Icon export failed", { description: (e as Error).message });
    } finally {
      setProgress(null);
    }
  };

  const warnings: string[] = [];
  if (src && Math.min(src.width, src.height) < 1024) warnings.push(`Source is ${src.width}×${src.height}. Use at least 1024×1024 for a sharp App Store icon.`);
  if (src && src.width !== src.height) warnings.push("Source isn't square. It's centred on the background colour.");
  if (src && !src.hasAlpha && s.monochrome) warnings.push("Monochrome (themed) icon needs a transparent logo, so it's skipped for opaque artwork.");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer items-center gap-5 rounded-2xl border border-dashed bg-gradient-to-br from-card to-muted/40 p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
            isDragActive ? "border-primary ring-4 ring-primary/15" : "hover:border-primary/40",
          )}
        >
          <input {...getInputProps()} aria-label="Upload app icon" />
          <div className="flex size-16 shrink-0 items-center justify-center rounded-[22%] bg-gradient-to-br from-fuchsia-500 to-orange-400 text-white shadow-md">
            <Sparkles className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{src ? name : "Drop your app icon"}</p>
            <p className="text-sm text-muted-foreground">
              {src
                ? `${src.width}×${src.height} · ${src.hasAlpha ? "transparent logo, placed on the background colour" : "full-bleed artwork"}`
                : "1024×1024 PNG recommended. A transparent logo gives the best Android adaptive & themed icons."}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary">
              <Upload className="size-3" /> {src ? "Drop to replace" : "Drop a file or click to browse"}
            </p>
          </div>
        </div>

        {warnings.map((w) => (
          <p key={w} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
          </p>
        ))}

        {src && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>How the system masks each icon. The dashed ring is Android&apos;s 66 dp safe zone.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
                <PreviewIos src={src} s={s} label="iOS home screen" />
                {s.darkVariants && src.hasAlpha && s.iosMode === "single" && <PreviewIos src={src} s={s} label="iOS dark" dark />}
                <PreviewAdaptive src={src} s={s} mask="circle" label="Android · circle" />
                <PreviewAdaptive src={src} s={s} mask="squircle" label="Android · squircle" />
                <PreviewAdaptive src={src} s={s} mask="rounded" label="Android · rounded" />
                {s.monochrome && src.hasAlpha && <PreviewAdaptive src={src} s={s} mask="circle" label="Android 13 themed" themed />}
                <PreviewStore src={src} s={s} />
              </CardContent>
            </Card>

            {plan && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="size-4" /> {plan.files.length + plan.texts.length + 1} files for{" "}
                    {FRAMEWORKS.find((f) => f.value === s.framework)?.label}
                  </CardTitle>
                  <CardDescription>Copy the folders over your project root.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-72 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                    {[...plan.files.map((f) => ({ path: f.path, meta: `${f.size}×${f.size}${f.opaque ? " · RGB" : " · RGBA"}` })), ...plan.texts.map((t) => ({ path: t.path, meta: "text" })), { path: "README.md", meta: "text" }]
                      .sort((a, b) => a.path.localeCompare(b.path))
                      .map((f) => (
                        <div key={f.path} className="flex justify-between gap-4">
                          <span className="truncate">app-icons/{f.path}</span>
                          <span className="shrink-0 text-muted-foreground">{f.meta}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-primary/20 bg-gradient-to-b from-primary/[0.04] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="size-4" /> Icon pack
            </CardTitle>
            <CardDescription>iOS asset catalog + Android mipmaps + store icons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Project type</Label>
              <Segmented className="w-full" size="sm" value={s.framework} options={FRAMEWORKS} onChange={(v) => set("framework", v)} />
              {s.framework === "react-native" && (
                <Input value={s.rnAppName} onChange={(e) => set("rnAppName", e.target.value)} placeholder="iOS target name" className="h-8 text-xs" />
              )}
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                {roots.ios}/
                <br />
                {roots.android}/
              </p>
            </div>

            <Separator />

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Apple className="size-4" /> iOS
              </h3>
              {s.framework !== "expo" && (
                <Row label="Asset catalog">
                  <Segmented
                    size="sm"
                    value={s.iosMode}
                    onChange={(v) => set("iosMode", v)}
                    options={[
                      { value: "single", label: "1024 single", title: "Xcode 14+" },
                      { value: "legacy", label: "All sizes", title: "Older Xcode / templates" },
                    ]}
                  />
                </Row>
              )}
              <Row label={`Logo size · ${Math.round(s.iosScale * 100)}%`}>
                <Slider className="w-32" min={0.4} max={1} step={0.01} value={s.iosScale} onValueChange={(v) => set("iosScale", Array.isArray(v) ? v[0] : v)} />
              </Row>
              {src?.hasAlpha && (s.iosMode === "single" || s.framework === "expo") && (
                <Row label="Dark & tinted (iOS 18+)">
                  <Switch checked={s.darkVariants} onCheckedChange={(v) => set("darkVariants", v)} />
                </Row>
              )}
              {s.darkVariants && src?.hasAlpha && (
                <ColorRow label="Dark background" value={s.darkBackground} onChange={(v) => set("darkBackground", v)} />
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Play className="size-4" /> Android
              </h3>
              <Row label={`Foreground · ${Math.round(s.androidScale * 108)} dp of 108`}>
                <Slider className="w-32" min={0.4} max={1} step={0.01} value={s.androidScale} onValueChange={(v) => set("androidScale", Array.isArray(v) ? v[0] : v)} />
              </Row>
              {s.androidScale > SAFE_ZONE + 0.01 && src?.hasAlpha && (
                <p className="text-xs text-amber-700 dark:text-amber-400">The logo extends past the 66 dp safe zone, so some masks may clip it.</p>
              )}
              <Row label="Monochrome (themed icons)">
                <Switch checked={s.monochrome} onCheckedChange={(v) => set("monochrome", v)} disabled={!!src && !src.hasAlpha} />
              </Row>
            </section>

            <Separator />

            <ColorRow
              label={`Background${src && !src.hasAlpha ? " (auto-picked from the artwork edge)" : ""}`}
              value={s.background}
              onChange={(v) => set("background", v)}
            />

            {progress !== null && <Progress value={progress} />}
            <Button size="lg" className="w-full" disabled={!src || !hexOk || progress !== null} onClick={generate}>
              {progress !== null ? <Loader2 className="animate-spin" /> : <FileArchive />}
              {progress !== null ? "Generating…" : "Download icon pack"}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

// ───────── Previews ─────────

function useIconCanvas(draw: () => ReturnType<typeof drawIcon> | null, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const img = draw();
    if (!c || !img) return;
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

const P = 240; // preview render size in px (displayed at ~96)

function PreviewIos({ src, s, label, dark }: { src: IconSource; s: IconSettings; label: string; dark?: boolean }) {
  const ref = useIconCanvas(
    () => drawIcon(src.bitmap, P, { bg: dark ? s.darkBackground : s.background, scale: s.iosScale, shape: "square" }),
    [src, s.background, s.darkBackground, s.iosScale, dark],
  );
  return (
    <Tile label={label}>
      <canvas ref={ref} className="size-24 rounded-[22.4%] shadow-md ring-1 ring-black/5" />
    </Tile>
  );
}

function PreviewAdaptive({
  src,
  s,
  mask,
  label,
  themed,
}: {
  src: IconSource;
  s: IconSettings;
  mask: "circle" | "squircle" | "rounded";
  label: string;
  themed?: boolean;
}) {
  // Full 108 dp canvas (background + foreground); only the centre 72 dp is visible.
  const ref = useIconCanvas(() => {
    const fg = drawIcon(src.bitmap, P, { bg: null, scale: s.androidScale, shape: "square", mono: themed });
    const c = drawIcon(src.bitmap, P, { bg: themed ? "#D7E3F8" : s.background, scale: 0, shape: "square", noLogo: true });
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    if (themed) {
      const t = drawIcon(fg as unknown as ImageBitmap, P, { bg: null, scale: 1, shape: "square" });
      const tctx = t.getContext("2d") as CanvasRenderingContext2D;
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = "#1F4C8F";
      tctx.fillRect(0, 0, P, P);
      ctx.drawImage(t, 0, 0);
    } else ctx.drawImage(fg, 0, 0);
    return c;
  }, [src, s.background, s.androidScale, themed]);
  const radius = mask === "circle" ? "50%" : mask === "squircle" ? "32%" : "18%";
  return (
    <Tile label={label}>
      <div className="relative size-24 overflow-hidden shadow-md ring-1 ring-black/5" style={{ borderRadius: radius }}>
        <canvas ref={ref} className="absolute" style={{ width: "150%", height: "150%", left: "-25%", top: "-25%" }} />
        <div
          className="pointer-events-none absolute rounded-full border border-dashed border-rose-500/70"
          style={{ inset: `${((72 - 66) / 2 / 72) * 100}%` }}
        />
      </div>
    </Tile>
  );
}

function PreviewStore({ src, s }: { src: IconSource; s: IconSettings }) {
  const ref = useIconCanvas(
    () => drawIcon(src.bitmap, P, { bg: s.background, scale: s.iosScale, shape: "square" }),
    [src, s.background, s.iosScale],
  );
  return (
    <Tile label="Google Play 512">
      <canvas ref={ref} className="size-24 rounded-[20%] shadow-md ring-1 ring-black/5" />
    </Tile>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2 rounded-xl bg-[radial-gradient(circle_at_30%_20%,var(--muted),transparent_70%)] p-3">
      {children}
      <figcaption className="text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
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

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ok = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={ok ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!ok} className="h-8 w-28 font-mono text-xs uppercase" />
      </div>
    </div>
  );
}
