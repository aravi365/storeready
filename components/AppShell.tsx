"use client";

import { useState } from "react";
import { FileText, Images, ShieldCheck, Sparkles } from "lucide-react";
import { IconGenerator } from "@/components/IconGenerator";
import { ListingStudio } from "@/components/ListingStudio";
import { ScreenshotStudio } from "@/components/ScreenshotStudio";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FontSizeControl } from "@/components/FontSizeControl";
import { cn } from "@/lib/utils";

type Tab = "screenshots" | "icons" | "listing";

const TABS: { id: Tab; label: string; icon: React.ReactNode; title: string; intro: string }[] = [
  {
    id: "screenshots",
    label: "Screenshots",
    icon: <Images className="size-4" />,
    title: "Upload-ready screenshots in one drop",
    intro:
      "Drop your mobile and iPad sets. StoreShot detects each image, scales it to every App Store and Google Play size, flattens any transparency, and checks each file against the store rules.",
  },
  {
    id: "icons",
    label: "App Icons",
    icon: <Sparkles className="size-4" />,
    title: "Every app icon, from one image",
    intro: "Generate iOS asset catalogs, Android adaptive and themed icons, and store listing icons, laid out for your Flutter, React Native or Expo project.",
  },
  {
    id: "listing",
    label: "Listing Text",
    icon: <FileText className="size-4" />,
    title: "Listing text that passes review",
    intro:
      "Paste your app name, descriptions and keywords. StoreShot checks them against Apple's App Review Guidelines and Google Play's metadata policy, explains each problem, and fixes what it safely can.",
  },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("screenshots");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
              <Images className="size-5" />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="font-semibold tracking-tight">StoreShot</p>
              <p className="text-xs text-muted-foreground">Store assets, sized and checked</p>
            </div>
          </div>

          <nav role="tablist" aria-label="Tools" className="mx-auto flex rounded-xl border bg-muted/60 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                title={t.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all sm:px-4",
                  tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <a
              href="https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground md:flex"
            >
              <ShieldCheck className="size-3 text-emerald-500" /> Specs checked Nov 2026
            </a>
            <FontSizeControl />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-primary">Free App Store &amp; Google Play asset toolkit</p>
          <h1 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
            {TABS.find((t) => t.id === tab)!.title}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {TABS.find((t) => t.id === tab)!.intro}
          </p>
        </div>

        {/* All tools stay mounted so switching tabs keeps your work */}
        <div hidden={tab !== "screenshots"}>
          <ScreenshotStudio />
        </div>
        <div hidden={tab !== "icons"}>
          <IconGenerator />
        </div>
        <div hidden={tab !== "listing"}>
          <ListingStudio />
        </div>

      </main>
    </div>
  );
}
