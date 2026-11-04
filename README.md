# StoreShot · App Store & Google Play screenshot resizer + app icon generator

**Live:** https://aravi365.github.io/storeshot/

Free, private, in-browser tool that resizes App Store and Google Play screenshots to every required size, strips the alpha channel, checks each file against the store rules, and packages everything into a ready-to-upload ZIP. It also generates iOS and Android app icons for Flutter, React Native and Expo projects. Nothing is uploaded: all processing happens in your browser.

![StoreShot screenshot resizer: Mobile and iPad upload sets, smart folder import, detected device, live previews and the ZIP folder tree](docs/screenshots-tab.jpg)

![StoreShot app icon generator: iOS and Android icon previews with the adaptive-icon safe zone and Flutter project layout](docs/app-icons-tab.jpg)

## Features
- **Every 2026 store size:** iPhone 6.9″ (1320×2868), iPad 13″ (2064×2752), Google Play phone, 7″ and 10″ tablet, and the 1024×500 feature graphic, in portrait or landscape.
- **Upload files or whole folders:** drop into the Mobile or iPad / Tablet set, or use **Smart folder import** with a tree like `en/iphone`, `th/ipad`. You can drop several folders at once, or pick them one after another. Hidden and non-image files are skipped.
- **Auto-detection:** device from the exact pixel size (about 30 known iPhone, iPad and Android resolutions), then aspect ratio; language (English/Thai) and type from file and folder names; warnings for oversized or low-resolution sources.
- **Store-compliant output:** true 24-bit RGB PNG (no alpha) or JPEG, a size cap for Google Play, and a compliance badge on every file.
- **Fit, Fill or Stretch:** letterbox over a blurred or solid background, smart crop, or exact stretch.
- **Auto-generated outputs** with a table of every file, and one ZIP sorted by store, language and device.
- **App icon generator:** iOS `AppIcon.appiconset`, Android legacy, round, adaptive and Android 13 themed icons, plus the App Store 1024 and Google Play 512 store icons.

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## How it works
1. Drop PNG/JPEG files or folders (up to 60 MB, 12000 px a side). The app detects the device, language and type for each image; you can change any of them per image.
2. Pick stores, presets, locales, scaling (Fit / Fill (smart crop) / Stretch), letterbox fill (blurred or solid), matte colour and format in **Export presets**.
3. Outputs render automatically in a Web Worker. Live previews show each target next to the original, with a compliance badge (click it to see the checks).
4. **Download ZIP** saves `app-store-assets-YYYY-MM-DD.zip`. A `manifest.json` inside lists the compliance results.

## Key files
| File | Purpose |
|---|---|
| `utils/presets.ts` | Store presets, the verified rules and their sources, the compliance evaluator |
| `utils/detect.ts` | Device / type / language detection from pixel size, file and folder names, and file size |
| `utils/canvasResizer.ts` | Decode, alpha/focal analysis, fit/fill/stretch composition, blur backdrop, step-down downscale, encoding with size cap |
| `utils/pngEncoder.ts` | True 24-bit RGB PNG encoder (canvas `toBlob` always writes RGBA, which Apple rejects) |
| `utils/zipExporter.ts` | JSZip folder layout + manifest + download |
| `utils/jobs.ts` / `utils/renderClient.ts` / `workers/render.worker.ts` | Job planning and off-main-thread rendering (falls back to the main thread) |
| `utils/iconGenerator.ts` | iOS / Android / store icon rendering and project layouts |
| `components/ImageUploader.tsx` | Upload sets, folder import, per-asset controls, live preview tiles |
| `components/ScreenshotStudio.tsx` | Auto-generate pipeline, export, progress, folder-tree preview |
| `components/IconGenerator.tsx` | App icon tab |
| `components/SeoGuide.tsx` | Size guide and FAQ shown below the tool |

## App icons
The **App Icons** tab turns one 1024×1024 image into:
- iOS `AppIcon.appiconset` (single 1024 size for Xcode 14+, or every legacy size), opaque 24-bit PNGs, optional iOS 18 dark/tinted
- Android `mipmap-*dpi` legacy + round icons, adaptive foreground (108 dp, 66 dp safe zone), monochrome themed icon, `ic_launcher.xml`, background colour resource
- Store icons: App Store 1024 and Google Play 512
- Laid out for Flutter, React Native (`ios/<App>/Images.xcassets`), Expo (`assets/images` + `app.json` snippet) or plain native projects
