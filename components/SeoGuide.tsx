/**
 * Server-rendered reference content. It is useful on its own (people search for
 * "app store screenshot sizes") and gives search engines real text to index,
 * since the tool itself is interactive.
 */
import { PRESETS } from "@/utils/presets";

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What screenshot size does the App Store require in 2026?",
    a: "Upload iPhone screenshots at 1320×2868 px (6.9-inch display, portrait) or 2868×1320 px (landscape); 1290×2796 and 1260×2736 are also accepted in that slot. If your app runs on iPad, add 13-inch iPad screenshots at 2064×2752 or 2048×2732 px. App Store Connect scales these down for smaller devices.",
  },
  {
    q: "What screenshot sizes does iPhone Duo (the foldable iPhone) need?",
    a: "iPhone Duo has two displays, and App Store Connect takes a set for each: the outer (folded) display at 1398×2034 px and the inner (unfolded) display at 2007×2853 px, in portrait or landscape. Uploading them adds an \u201coptimized for iPhone Duo\u201d badge to your product page, and they become required from April 2027 for apps built with the iOS 27.1 SDK or later. Drop images into StoreShot\u2019s iPhone Duo set to get both sizes.",
  },
  {
    q: "Why does App Store Connect reject my PNG screenshots?",
    a: "The most common reasons are a wrong pixel size or an alpha channel. Apple rejects images that contain transparency or an alpha channel, even if every pixel is opaque. Browsers and many design tools save RGBA PNGs by default. StoreShot flattens every image onto a solid background and writes a true 24-bit RGB PNG.",
  },
  {
    q: "What are the Google Play screenshot requirements?",
    a: "JPEG or 24-bit PNG with no alpha, 2 to 8 screenshots per device type, each side between 320 and 3840 px, and the long side no more than twice the short side. For promotion eligibility use 9:16 at 1080×1920 or larger. Tablet and Chromebook screenshots should be 9:16 or 16:9 with sides between 1080 and 7680 px.",
  },
  {
    q: "What size is the Google Play feature graphic?",
    a: "Exactly 1024×500 px, JPEG or 24-bit PNG without alpha. It is required to publish a store listing.",
  },
  {
    q: "Are my images uploaded to a server?",
    a: "No. StoreShot runs entirely in your browser using the Canvas API and Web Workers. Your screenshots and icons never leave your device.",
  },
  {
    q: "Can it generate app icons for Flutter and React Native?",
    a: "Yes. The App Icons tab turns one 1024×1024 image into an iOS AppIcon.appiconset and Android mipmap folders (legacy, round, adaptive foreground and Android 13 monochrome icons), laid out for Flutter, React Native, Expo or native projects, plus the 1024 App Store and 512 Google Play store icons.",
  },
];

const ICONS: [string, string, string][] = [
  ["iOS app icon (App Store)", "1024×1024", "Opaque PNG, no alpha, no pre-rounded corners"],
  ["Google Play store icon", "512×512", "Full square PNG, up to 1024 KB"],
  ["Android legacy launcher", "48 dp (48–192 px)", "mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi"],
  ["Android adaptive layers", "108 dp (108–432 px)", "Keep the logo inside the 66 dp safe zone"],
  ["Android 13 themed icon", "108 dp monochrome", "White silhouette on transparency"],
];

export function SeoGuide() {
  const apple = PRESETS.filter((p) => p.store === "app_store");
  const play = PRESETS.filter((p) => p.store === "play_store" && !p.warning);
  const dims = (p: (typeof PRESETS)[number]) =>
    p.landscapeOnly ? `${p.portrait.w}×${p.portrait.h}` : `${p.portrait.w}×${p.portrait.h} · ${p.portrait.h}×${p.portrait.w}`;

  return (
    <section aria-labelledby="guide" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="rounded-3xl border bg-card/60 p-6 backdrop-blur sm:p-10">
        <h2 id="guide" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          App Store &amp; Google Play screenshot sizes (2026 guide)
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          The exact sizes StoreShot exports, checked against Apple&apos;s App Store Connect and Google&apos;s Play
          Console help pages in November 2026. Drop your images above and every size below is generated for you.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <SizeTable
            title="Apple App Store screenshot sizes"
            rows={apple.map((p) => [p.label, dims(p), p.note ?? ""])}
          />
          <SizeTable
            title="Google Play screenshot & feature graphic sizes"
            rows={play.map((p) => [p.label, dims(p), p.note ?? ""])}
          />
        </div>

        <div className="mt-8">
          <SizeTable title="iOS & Android app icon sizes" rows={ICONS} />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h3 className="text-lg font-semibold">How to resize screenshots for the App Store and Play Store</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Drop your phone screenshots into the Mobile set, iPad screenshots into the iPad / Tablet set and foldable screenshots into the iPhone Duo set, or drop whole folders (for example en/iphone and th/ipad) into Smart folder import.</li>
              <li>StoreShot detects each device from its resolution and tags English or Thai from the file name.</li>
              <li>Choose Fit (letterbox), Fill (smart crop) or Stretch. Transparency is flattened automatically.</li>
              <li>Check the compliance badge on each preview, then download one ZIP sorted by store, language and device.</li>
            </ol>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Frequently asked questions</h3>
            <div className="mt-3 divide-y rounded-xl border">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-4 py-3">
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90">›</span>
                    {f.q}
                  </summary>
                  <p className="mt-2 pl-5 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-10 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <p>All processing happens in your browser. Nothing is uploaded.</p>
        <p>
          Open source on{" "}
          <a className="underline hover:text-foreground" href="https://github.com/aravi365/storeshot">
            GitHub
          </a>
          . Not affiliated with Apple or Google.
        </p>
      </footer>
    </section>
  );
}

function SizeTable({ title, rows }: { title: string; rows: [string, string, string][] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Asset</th>
              <th className="px-4 py-2 font-medium">Pixels</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b, c]) => (
              <tr key={a} className="border-t align-top">
                <td className="px-4 py-2 font-medium whitespace-nowrap">{a}</td>
                <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{b}</td>
                <td className="min-w-56 px-4 py-2 text-xs text-muted-foreground">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
