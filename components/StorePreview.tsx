"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  BatteryFull,
  ChevronLeft,
  ChevronRight,
  Download,
  Gamepad2,
  Heart,
  Layers,
  Newspaper,
  Rocket,
  Images,
  Info,
  MoreVertical,
  Search,
  Share,
  Share2,
  Signal,
  Smartphone,
  Sparkles,
  Star,
  Tablet,
  UserRound,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/Segmented";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE, languageById, languageName } from "@/utils/languages";
import { EMPTY_LISTING, type Listing } from "@/utils/listingRules";
import {
  featureGraphicFor,
  previewLanguages,
  shotsFor,
  usePreviewData,
  type PreviewDevice,
  type PreviewShot,
} from "@/utils/previewStore";

type StoreId = "apple" | "play";
type Tone = "light" | "dark";

/** Logical screen sizes (CSS px / points) of the frames */
const SCREEN: Record<PreviewDevice, { w: number; h: number; label: string }> = {
  iphone: { w: 393, h: 852, label: "iPhone" },
  ipad: { w: 1180, h: 820, label: "iPad (landscape)" },
  "android-phone": { w: 412, h: 915, label: "Android phone" },
  "android-tablet": { w: 1280, h: 800, label: "Android tablet (landscape)" },
};
const BEZEL: Record<PreviewDevice, { pad: number; radius: number; screenRadius: number }> = {
  iphone: { pad: 12, radius: 62, screenRadius: 50 },
  ipad: { pad: 20, radius: 40, screenRadius: 22 },
  "android-phone": { pad: 10, radius: 46, screenRadius: 36 },
  "android-tablet": { pad: 20, radius: 32, screenRadius: 18 },
};

export function StorePreview({ onNavigate }: { onNavigate: (tab: "screenshots" | "icons" | "listing") => void }) {
  const data = usePreviewData();
  const { resolvedTheme } = useTheme();
  const [store, setStore] = useState<StoreId>("apple");
  const [device, setDevice] = useState<PreviewDevice>("iphone");
  const [tone, setTone] = useState<Tone | "auto">("auto");
  const languages = useMemo(() => {
    const l = previewLanguages(data);
    return l.length ? l : [DEFAULT_LANGUAGE];
  }, [data]);
  const [locale, setLocale] = useState<string>(DEFAULT_LANGUAGE);
  const activeLocale = languages.includes(locale) ? locale : languages[0];
  const effectiveTone: Tone = tone === "auto" ? (resolvedTheme === "dark" ? "dark" : "light") : tone;

  const pickStore = (s: StoreId) => {
    setStore(s);
    setDevice(s === "apple" ? (device === "android-tablet" ? "ipad" : "iphone") : device === "ipad" ? "android-tablet" : "android-phone");
  };

  const listing = data.listings[activeLocale] ?? EMPTY_LISTING;
  const shots = shotsFor(data.shots, device, activeLocale);
  const counts = {
    iphone: shotsFor(data.shots, "iphone", activeLocale).length,
    ipad: shotsFor(data.shots, "ipad", activeLocale).length,
    "android-phone": shotsFor(data.shots, "android-phone", activeLocale).length,
    "android-tablet": shotsFor(data.shots, "android-tablet", activeLocale).length,
  };
  const feature = featureGraphicFor(data.shots, activeLocale);
  const nothing = !data.shots.length && !Object.values(data.listings).some((l) => Object.values(l).some(Boolean)) && !data.icon;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            aria-label="Store"
            value={store}
            onChange={pickStore}
            options={[
              { value: "apple", label: "App Store" },
              { value: "play", label: "Google Play" },
            ]}
          />
          <Segmented
            aria-label="Device"
            value={device}
            onChange={setDevice}
            options={
              store === "apple"
                ? [
                    { value: "iphone", label: <><Smartphone className="size-3.5" /> iPhone</> },
                    { value: "ipad", label: <><Tablet className="size-3.5" /> iPad</> },
                  ]
                : [
                    { value: "android-phone", label: <><Smartphone className="size-3.5" /> Phone</> },
                    { value: "android-tablet", label: <><Tablet className="size-3.5" /> Tablet</> },
                  ]
            }
          />
          <Segmented
            aria-label="Appearance"
            value={tone}
            onChange={setTone}
            options={[
              { value: "auto", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          {languages.length > 1 && (
            <select
              aria-label="Language"
              value={activeLocale}
              onChange={(e) => setLocale(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border bg-muted/50 px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          )}
        </div>

        {nothing ? (
          <EmptyPreview onNavigate={onNavigate} />
        ) : (
          <DeviceStage device={device} key={`${store}-${device}-${activeLocale}`}>
            {store === "apple" ? (
              <AppStorePage
                device={device === "ipad" ? "ipad" : "iphone"}
                tone={effectiveTone}
                listing={listing}
                icon={data.icon?.apple}
                developer={data.company}
                locale={activeLocale}
                shots={shots}
                otherDeviceCount={device === "ipad" ? counts.iphone : counts.ipad}
              />
            ) : (
              <PlayPage
                device={device === "android-tablet" ? "tablet" : "phone"}
                tone={effectiveTone}
                listing={listing}
                icon={data.icon?.play}
                developer={data.company}
                shots={shots}
                feature={feature}
              />
            )}
          </DeviceStage>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          A close approximation of each store&apos;s product page for checking layout, order and text length. Ratings, downloads,
          age rating and dates are placeholders. Scroll inside the screen to see the whole page.
        </p>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s shown</CardTitle>
            <CardDescription>{languageName(activeLocale)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Screenshots" value={shots.length ? `${shots.length} · ${shots[0].width}×${shots[0].height}` : "None for this device"} warn={!shots.length} />
            <Row label="App icon" value={data.icon ? "From App Icons" : "Placeholder"} warn={!data.icon} />
            <Row
              label="Name & text"
              value={(store === "apple" ? listing["apple.name"] : listing["play.title"]) ? "From Listing Text" : "Placeholder"}
              warn={!(store === "apple" ? listing["apple.name"] : listing["play.title"])}
            />
            {store === "play" && device === "android-tablet" && (
              <Row label="Feature graphic" value={feature ? "Shown as banner" : "None"} warn={!feature} />
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onNavigate("screenshots")}>
                <Images /> Screenshots
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate("icons")}>
                <Sparkles /> Icon
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate("listing")}>
                Listing text
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Lead with your strongest screens: search results and the top of the page only show the first few.</p>
            <p>Check that headline text in your screenshots is still readable at this size.</p>
            <p>Watch the name and subtitle: long text is cut off with “…” on smaller screens.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right font-medium", warn && "text-amber-700 dark:text-amber-400")}>{value}</span>
    </div>
  );
}

function EmptyPreview({ onNavigate }: { onNavigate: (tab: "screenshots" | "icons" | "listing") => void }) {
  return (
    <Card className="items-center py-14 text-center">
      <CardContent className="max-w-md space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-6" />
        </div>
        <p className="font-semibold">Nothing to preview yet</p>
        <p className="text-sm text-muted-foreground">
          Add screenshots, an app icon and your listing text in the other tabs. They appear here as an App Store or Google Play
          page on iPhone, iPad, Android phones and tablets.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => onNavigate("screenshots")}>
            <Images /> Add screenshots
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate("icons")}>
            <Sparkles /> Add an icon
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate("listing")}>
            Add listing text
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Device frames ─────────────────────────

/** Scales a fixed-size device to the available width (never above 100%). */
function DeviceStage({ device, children }: { device: PreviewDevice; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = SCREEN[device];
  const b = BEZEL[device];
  const fw = w + b.pad * 2;
  const fh = h + b.pad * 2;
  const portrait = device === "iphone" || device === "android-phone";
  // Phones: also cap height so the whole device fits on a laptop screen.
  const scale = Math.min(1, (avail - 8) / fw, portrait ? 760 / fh : 1);
  return (
    <div ref={ref} className="flex justify-center rounded-2xl border bg-[radial-gradient(ellipse_at_top,var(--muted),transparent_70%)] py-6">
      <div style={{ width: fw * scale, height: fh * scale }} className="relative">
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: fw, height: fh, transform: `scale(${scale})` }}
          data-device={device}
        >
          <div
            className="relative h-full w-full bg-neutral-900 shadow-2xl ring-1 ring-black/40 dark:bg-neutral-800"
            style={{ borderRadius: b.radius, padding: b.pad }}
          >
            <div className="relative h-full w-full overflow-hidden bg-white" style={{ borderRadius: b.screenRadius }}>
              {children}
              {device === "iphone" && (
                <div className="pointer-events-none absolute top-[11px] left-1/2 z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
              )}
              {device === "android-phone" && (
                <div className="pointer-events-none absolute top-[12px] left-1/2 z-20 size-[14px] -translate-x-1/2 rounded-full bg-black" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ tone, style }: { tone: Tone; style: "ios" | "android" }) {
  const c = tone === "dark" ? "#fff" : "#000";
  return (
    <div
      className={cn("flex shrink-0 items-center justify-between", style === "ios" ? "h-[54px] px-8 pt-1" : "h-[36px] px-5")}
      style={{ color: c, fontSize: style === "ios" ? 17 : 14, fontWeight: style === "ios" ? 600 : 500 }}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <Signal className="size-4" />
        <Wifi className="size-4" />
        <BatteryFull className="size-5" />
      </span>
    </div>
  );
}

// ───────────────────────── App Store ─────────────────────────

function AppIcon({ src, size, radius, name, tone }: { src?: string; size: number; radius: number; name: string; tone: Tone }) {
  const ring = tone === "dark" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: radius, boxShadow: `0 0 0 0.5px ${ring}` }} />;
  }
  return (
    <div
      className="flex items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 font-bold text-white"
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.42, boxShadow: `0 0 0 0.5px ${ring}` }}
    >
      {(name.trim()[0] ?? "A").toUpperCase()}
    </div>
  );
}

const IOS = {
  light: { bg: "#ffffff", text: "#000000", sub: "#8a8a8e", sep: "#e5e5ea", tint: "#007aff", fill: "#f2f2f7" },
  dark: { bg: "#000000", text: "#ffffff", sub: "#8e8e93", sep: "#38383a", tint: "#0a84ff", fill: "#1c1c1e" },
};

function AppStorePage({
  device,
  tone,
  listing,
  icon,
  developer,
  locale,
  shots,
  otherDeviceCount,
}: {
  device: "iphone" | "ipad";
  tone: Tone;
  listing: Listing;
  icon?: string;
  developer: string;
  locale: string;
  shots: PreviewShot[];
  otherDeviceCount: number;
}) {
  const c = IOS[tone];
  const pad = device === "iphone" ? 20 : 40;
  const name = listing["apple.name"] || "Your App Name";
  const subtitle = listing["apple.subtitle"] || "Your subtitle goes here";
  const description = listing["apple.description"] || "Your description appears here. Add it in the Listing Text tab to see how the first lines read before “more”.";
  const whatsNew = listing["apple.whatsNew"];
  const promo = listing["apple.promo"];
  const dev = developer || "Developer Name";
  const code = languageById(locale).id.split("-")[0].toUpperCase();
  const big = device === "ipad";

  // Screenshot display height (points): portrait iPhone shots are large, landscape fills the width.
  const shotH = (s: PreviewShot) => {
    const landscape = s.width > s.height;
    if (big) return landscape ? 360 : 560;
    return landscape ? Math.round(((393 - pad * 2) * s.height) / s.width) : 470;
  };

  return (
    <div className="flex h-full flex-col" style={{ background: c.bg, color: c.text, fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif' }}>
      {device === "iphone" ? <StatusBar tone={tone} style="ios" /> : <div className="h-6 shrink-0" />}
      <div className="flex h-11 shrink-0 items-center" style={{ paddingInline: pad - 8, color: c.tint }}>
        <ChevronLeft className="size-7" strokeWidth={2.4} />
        <span style={{ fontSize: 17 }}>Search</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {/* Header */}
        <div className="flex gap-4" style={{ padding: `8px ${pad}px 0` }}>
          <AppIcon src={icon} size={big ? 180 : 118} radius={big ? 40 : 27} name={name} tone={tone} />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="line-clamp-2 leading-tight" style={{ fontSize: big ? 30 : 22, fontWeight: 600, letterSpacing: -0.3 }}>
              {name}
            </p>
            <p className="truncate" style={{ fontSize: big ? 19 : 15, color: c.sub, marginTop: 2 }}>
              {subtitle}
            </p>
            <div className="mt-auto flex items-end justify-between pt-3">
              <div className="flex flex-col items-start gap-0.5">
                <span className="rounded-full px-5 py-1 text-white" style={{ background: c.tint, fontSize: 15, fontWeight: 700 }}>
                  Get
                </span>
                <span style={{ fontSize: 10, color: c.sub }}>In-App Purchases</span>
              </div>
              <Share className="size-6" style={{ color: c.tint }} />
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div className="mt-5 flex overflow-x-auto [scrollbar-width:none]" style={{ borderTop: `0.5px solid ${c.sep}`, paddingInline: pad - 4 }}>
          {[
            ["1.2K RATINGS", "4.8", <Stars key="s" color={c.sub} />],
            ["AGES", "4+", "Years Old"],
            ["CHART", "No. 12", "Finance"],
            ["DEVELOPER", <UserRound key="u" className="mx-auto size-6" />, dev],
            ["LANGUAGE", code, "+ 2 More"],
          ].map(([top, mid, bottom], i) => (
            <div key={i} className="flex shrink-0 flex-col items-center justify-center gap-1 py-3 text-center" style={{ width: big ? 170 : 108, borderLeft: i ? `0.5px solid ${c.sep}` : undefined }}>
              <span style={{ fontSize: 11, color: c.sub, letterSpacing: 0.4, fontWeight: 600 }}>{top}</span>
              <span style={{ fontSize: 21, color: c.sub, fontWeight: 700 }}>{mid}</span>
              <span className="max-w-full truncate px-1" style={{ fontSize: 12, color: c.sub }}>
                {bottom}
              </span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `0.5px solid ${c.sep}`, marginInline: pad }} />

        {/* What's New */}
        {whatsNew && (
          <Section title="What’s New" link="Version History" pad={pad} c={c} big={big}>
            <div className="flex justify-between" style={{ fontSize: 14, color: c.sub }}>
              <span>Version 1.0</span>
              <span>1d ago</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-line" style={{ fontSize: 15, lineHeight: "20px" }}>
              {whatsNew}
            </p>
          </Section>
        )}

        {/* Preview (screenshots) */}
        <div style={{ paddingTop: 18 }}>
          <p style={{ fontSize: big ? 26 : 22, fontWeight: 700, paddingInline: pad, marginBottom: 12 }}>Preview</p>
          {shots.length ? (
            <div className="flex snap-x snap-mandatory gap-[10px] overflow-x-auto [scrollbar-width:none]" style={{ paddingInline: pad, scrollPaddingInline: pad }}>
              {shots.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s.jobId}
                  src={s.url}
                  alt=""
                  className="shrink-0 snap-start object-cover"
                  style={{ height: shotH(s), width: (shotH(s) * s.width) / s.height, borderRadius: big ? 22 : 18, boxShadow: `0 0 0 0.5px ${c.sep}` }}
                />
              ))}
            </div>
          ) : (
            <NoShots c={c} pad={pad} text={`No ${device === "ipad" ? "iPad 13″" : "iPhone"} screenshots for this language yet.`} />
          )}
          <div className="mt-3 flex items-center gap-1.5" style={{ paddingInline: pad, fontSize: 13, color: c.sub }}>
            {device === "iphone" ? <Smartphone className="size-4" /> : <Tablet className="size-4" />}
            <span>{device === "iphone" ? "iPhone" : "iPad"}</span>
            {otherDeviceCount > 0 && (
              <>
                <span className="mx-1">·</span>
                {device === "iphone" ? <Tablet className="size-4" /> : <Smartphone className="size-4" />}
                <span>{device === "iphone" ? "iPad" : "iPhone"}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ borderTop: `0.5px solid ${c.sep}`, margin: `18px ${pad}px 0` }} />

        {/* Description */}
        <div style={{ padding: `16px ${pad}px 0` }}>
          {promo && <p className="mb-3 line-clamp-3" style={{ fontSize: 15, lineHeight: "20px" }}>{promo}</p>}
          <div className="relative">
            <p className="line-clamp-3 whitespace-pre-line" style={{ fontSize: 15, lineHeight: "20px" }}>
              {description}
            </p>
            <span className="absolute right-0 bottom-0 pl-6" style={{ fontSize: 15, color: c.tint, background: `linear-gradient(to right, transparent, ${c.bg} 30%)` }}>
              more
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p style={{ fontSize: 15, color: c.tint }}>{dev}</p>
              <p style={{ fontSize: 13, color: c.sub }}>Developer</p>
            </div>
            <ChevronRight className="size-5" style={{ color: c.sub }} />
          </div>
        </div>

        {/* Ratings */}
        <Section title="Ratings & Reviews" link="See All" pad={pad} c={c} big={big}>
          <div className="flex items-end gap-2">
            <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>4.8</span>
            <span style={{ fontSize: 15, color: c.sub, paddingBottom: 6 }}>out of 5</span>
          </div>
        </Section>
        <div className="h-10" />
      </div>
      {device === "iphone" && <IosTabBar c={c} />}
    </div>
  );
}

function Stars({ color }: { color: string }) {
  return (
    <span className="flex justify-center gap-px">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="size-3" style={{ color, fill: color }} />
      ))}
    </span>
  );
}

function Section({
  title,
  link,
  pad,
  c,
  big,
  children,
}: {
  title: string;
  link?: string;
  pad: number;
  c: (typeof IOS)["light"];
  big: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: `18px ${pad}px 0` }}>
      <div className="mb-2 flex items-baseline justify-between">
        <p style={{ fontSize: big ? 26 : 22, fontWeight: 700 }}>{title}</p>
        {link && <span style={{ fontSize: 17, color: c.tint }}>{link}</span>}
      </div>
      {children}
    </div>
  );
}

function NoShots({ c, pad, text }: { c: { fill: string; sub: string }; pad: number; text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl text-center" style={{ marginInline: pad, background: c.fill, color: c.sub, fontSize: 14 }}>
      {text}
    </div>
  );
}

function IosTabBar({ c }: { c: (typeof IOS)["light"] }) {
  return (
    <div className="flex h-[83px] shrink-0 justify-around pt-2" style={{ borderTop: `0.5px solid ${c.sep}`, background: c.bg, fontSize: 10, color: c.sub }}>
      {(
        [
          ["Today", Newspaper],
          ["Games", Rocket],
          ["Apps", Layers],
          ["Arcade", Gamepad2],
          ["Search", Search],
        ] as const
      ).map(([t, Icon], i) => (
        <div key={t} className="flex flex-col items-center gap-1" style={{ color: i === 2 ? c.tint : c.sub }}>
          <Icon className="size-6" strokeWidth={i === 2 ? 2.4 : 1.8} />
          {t}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Google Play ─────────────────────────

const PLAY = {
  light: { bg: "#ffffff", text: "#1f1f1f", sub: "#444746", line: "#c4c7c5", green: "#01875f", onGreen: "#ffffff", chip: "#f1f4f3" },
  dark: { bg: "#131314", text: "#e3e3e3", sub: "#c4c7c5", line: "#444746", green: "#a8dab5", onGreen: "#0d3b22", chip: "#1e1f20" },
};

function PlayPage({
  device,
  tone,
  listing,
  icon,
  developer,
  shots,
  feature,
}: {
  device: "phone" | "tablet";
  tone: Tone;
  listing: Listing;
  icon?: string;
  developer: string;
  shots: PreviewShot[];
  feature?: PreviewShot;
}) {
  const c = PLAY[tone];
  const big = device === "tablet";
  const pad = big ? 32 : 24;
  const title = listing["play.title"] || listing["apple.name"] || "Your App Name";
  const short = listing["play.short"] || "Your short description appears here.";
  const dev = developer || "Developer Name";
  const shotH = (s: PreviewShot) => (big ? (s.width > s.height ? 300 : 420) : s.width > s.height ? 160 : 260);

  return (
    <div className="flex h-full flex-col" style={{ background: c.bg, color: c.text, fontFamily: "var(--font-google-sans), Roboto, system-ui, sans-serif" }}>
      <StatusBar tone={tone} style="android" />
      <div className="flex h-14 shrink-0 items-center justify-between px-3" style={{ color: c.sub }}>
        <ArrowLeft className="size-6" />
        <span className="flex items-center gap-5 pr-1">
          <Search className="size-6" />
          <MoreVertical className="size-6" />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none]">
        {big && feature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={feature.url} alt="" className="mb-4 w-full object-cover" style={{ aspectRatio: "1024 / 500", maxHeight: 240 }} />
        )}
        <div className={cn("flex gap-4", big ? "items-center" : "items-start")} style={{ paddingInline: pad }}>
          <AppIcon src={icon} size={big ? 96 : 72} radius={big ? 22 : 16} name={title} tone={tone} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2" style={{ fontSize: big ? 32 : 22, lineHeight: big ? "40px" : "28px", fontWeight: 400 }}>
              {title}
            </p>
            <p className="truncate" style={{ fontSize: big ? 16 : 14, color: c.green, fontWeight: 500, marginTop: 2 }}>
              {dev}
            </p>
            <p style={{ fontSize: 12, color: c.sub, marginTop: 2 }}>Contains ads · In-app purchases</p>
          </div>
          {big && <InstallButton c={c} width={220} />}
        </div>

        {/* Stats */}
        <div className={cn("mt-5 flex items-center", big ? "justify-start gap-0" : "justify-around")} style={{ paddingInline: big ? pad : 8 }}>
          {[
            [<span key="r" className="flex items-center gap-0.5">4.5 <Star className="size-3" style={{ fill: c.text }} /></span>, "12K reviews"],
            [<span key="d" className="flex items-center gap-0.5"><Download className="size-4" /> 1M+</span>, "Downloads"],
            [<span key="a" className="rounded-[3px] px-1 text-[11px]" style={{ border: `1.5px solid ${c.text}` }}>3+</span>, "Rated for 3+"],
          ].map(([top, bottom], i) => (
            <div key={i} className="flex flex-col items-center px-5 text-center" style={{ borderLeft: i ? `1px solid ${c.line}` : undefined }}>
              <span style={{ fontSize: 14, fontWeight: 500, height: 20 }} className="flex items-center">
                {top}
              </span>
              <span style={{ fontSize: 12, color: c.sub }}>{bottom}</span>
            </div>
          ))}
        </div>

        {!big && (
          <div style={{ padding: `20px ${pad}px 0` }}>
            <InstallButton c={c} />
            <div className="mt-4 flex justify-center gap-10" style={{ fontSize: 14, color: c.green, fontWeight: 500 }}>
              <span className="flex items-center gap-2"><Share2 className="size-4" /> Share</span>
              <span className="flex items-center gap-2"><Heart className="size-4" /> Add to wishlist</span>
            </div>
          </div>
        )}

        {/* Screenshots */}
        <div style={{ paddingTop: 22 }}>
          {shots.length ? (
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none]" style={{ paddingInline: pad, scrollPaddingInline: pad }}>
              {shots.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s.jobId}
                  src={s.url}
                  alt=""
                  className="shrink-0 snap-start object-cover"
                  style={{ height: shotH(s), width: (shotH(s) * s.width) / s.height, borderRadius: 8 }}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl text-center" style={{ marginInline: pad, background: c.chip, color: c.sub, fontSize: 14 }}>
              No {big ? "tablet" : "phone"} screenshots for this language yet.
            </div>
          )}
        </div>

        {/* About */}
        <div style={{ padding: `24px ${pad}px 0`, maxWidth: big ? 760 : undefined }}>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: big ? 22 : 18, fontWeight: 500 }}>About this app</p>
            <ArrowLeft className="size-5 rotate-180" style={{ color: c.sub }} />
          </div>
          <p className="mt-3 line-clamp-3" style={{ fontSize: 14, lineHeight: "20px", color: c.sub }}>
            {short}
          </p>
          <p className="mt-4" style={{ fontSize: 14, fontWeight: 500 }}>Updated on</p>
          <p style={{ fontSize: 14, color: c.sub }}>Nov 5, 2026</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Finance", "Budgeting"].map((t) => (
              <span key={t} className="rounded-lg px-4 py-1.5" style={{ fontSize: 14, border: `1px solid ${c.line}`, color: c.sub }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding: `24px ${pad}px 0`, maxWidth: big ? 760 : undefined }}>
          <div className="flex items-center justify-between">
            <p style={{ fontSize: big ? 22 : 18, fontWeight: 500 }}>Data safety</p>
            <ArrowLeft className="size-5 rotate-180" style={{ color: c.sub }} />
          </div>
          <p className="mt-2" style={{ fontSize: 14, lineHeight: "20px", color: c.sub }}>
            Safety starts with understanding how developers collect and share your data.
          </p>
        </div>
        <div className="h-12" />
      </div>
      {!big && <div className="mx-auto mb-2 h-1 w-28 shrink-0 rounded-full" style={{ background: c.sub, opacity: 0.6 }} />}
    </div>
  );
}

function InstallButton({ c, width }: { c: (typeof PLAY)["light"]; width?: number }) {
  return (
    <div
      className="flex h-10 shrink-0 items-center justify-center rounded-full"
      style={{ background: c.green, color: c.onGreen, fontSize: 14, fontWeight: 500, width: width ?? "100%" }}
    >
      Install
    </div>
  );
}
