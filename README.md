# StoreShot · App Store & Google Play screenshot resizer + app icon generator

**Live:** https://aravi365.github.io/storeshot/

Client-side tool that resizes, flattens (no alpha) and packages App Store and Google Play screenshots into a ready-to-upload ZIP. Built with Next.js App Router, TypeScript, Tailwind CSS v4 and shadcn/ui.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## How it works
1. Drop PNG/JPEG files (up to 60 MB, 12000 px a side). The app guesses the device, locale and type from the file name and aspect ratio (`*_th*`, `ipad`, `feature`, ~2:1 landscape). You can change each one per image.
2. Pick stores, presets, locales, scaling (Fit / Fill (smart crop) / Stretch), letterbox fill (blurred or solid), matte colour and format in **Export presets**.
3. Live previews show each target next to the original, with a compliance badge (click it to see the checks).
4. **Download ZIP** renders full-res in a Web Worker (OffscreenCanvas), checks each output, and saves `app-store-assets-YYYY-MM-DD.zip`. A `manifest.json` inside lists the compliance results.

## Key files
| File | Purpose |
|---|---|
| `utils/presets.ts` | Store presets, the verified rules and their sources, the compliance evaluator |
| `utils/canvasResizer.ts` | Decode, alpha/focal analysis, fit/fill/stretch composition, blur backdrop, step-down downscale, encoding with size cap |
| `utils/pngEncoder.ts` | True 24-bit RGB PNG encoder (canvas `toBlob` always writes RGBA, which Apple rejects) |
| `utils/zipExporter.ts` | JSZip folder layout + manifest + file-saver download |
| `utils/jobs.ts` / `utils/renderClient.ts` / `workers/render.worker.ts` | Job planning and off-main-thread rendering (falls back to the main thread) |
| `components/ImageUploader.tsx` | Dropzone, ingest, per-asset controls, live preview tiles |
| `components/PresetSelector.tsx` | Platform, preset, locale, scaling and output settings |
| `app/page.tsx` | Dashboard, export orchestration, progress, folder-tree preview |

## App icons
The **App Icons** tab turns one 1024×1024 image into:
- iOS `AppIcon.appiconset` (single 1024 size for Xcode 14+, or every legacy size), opaque 24-bit PNGs, optional iOS 18 dark/tinted
- Android `mipmap-*dpi` legacy + round icons, adaptive foreground (108 dp, 66 dp safe zone), monochrome themed icon, `ic_launcher.xml`, background colour resource
- Store icons: App Store 1024 and Google Play 512
- Laid out for Flutter, React Native (`ios/<App>/Images.xcassets`), Expo (`assets/images` + `app.json` snippet) or plain native projects
