"use client";

import { useState } from "react";
import { Images, ShieldCheck, Sparkles } from "lucide-react";
import { IconGenerator } from "@/components/IconGenerator";
import { ScreenshotStudio } from "@/components/ScreenshotStudio";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type Tab = "screenshots" | "icons";

const TABS: { id: Tab; label: string; icon: React.ReactNode; blurb: string }[] = [
  { id: "screenshots", label: "Screenshots", icon: <Images className="size-4" />, blurb: "App Store & Google Play" },
  { id: "icons", label: "App Icons", icon: <Sparkles className="size-4" />, blurb: "Flutter · React Native · Expo" },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("screenshots");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
              <Images className="size-5" />
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="font-semibold tracking-tight">StoreShot</p>
              <p className="text-[11px] text-muted-foreground">Store assets, sized and checked</p>
            </div>
          </div>

          <nav role="tablist" aria-label="Tools" className="mx-auto flex rounded-xl border bg-muted/60 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all sm:px-4",
                  tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <a
              href="https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground md:flex"
            >
              <ShieldCheck className="size-3 text-emerald-500" /> Specs checked Nov 2026
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-primary">Free App Store &amp; Google Play asset toolkit</p>
          <h1 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
            {tab === "screenshots" ? "Upload-ready screenshots in one drop" : "Every app icon, from one image"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {tab === "screenshots"
              ? "Drop your mobile and iPad sets. StoreShot detects each image, scales it to every App Store and Google Play size, flattens any transparency, and checks each file against the store rules."
              : "Generate iOS asset catalogs, Android adaptive and themed icons, and store listing icons, laid out for your Flutter, React Native or Expo project."}
          </p>
        </div>

        {/* Both tools stay mounted so switching tabs keeps your work */}
        <div hidden={tab !== "screenshots"}>
          <ScreenshotStudio />
        </div>
        <div hidden={tab !== "icons"}>
          <IconGenerator />
        </div>

      </main>
    </div>
  );
}
