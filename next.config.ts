import type { NextConfig } from "next";

// GitHub Pages serves project sites from /<repo>/, so the build is told its subfolder.
// The Pages workflow sets NEXT_PUBLIC_BASE_PATH=/storeready; local dev leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Fully client-side app: export static HTML/JS and host it on GitHub Pages.
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
