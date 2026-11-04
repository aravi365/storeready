import { AppShell } from "@/components/AppShell";
import { SeoGuide, FAQ } from "@/components/SeoGuide";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (runs in the browser)",
      browserRequirements: "Requires a modern browser with Canvas and Web Workers",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Resize screenshots for iPhone 6.9-inch (1320×2868), the required iPhone 6.3-inch (1206×2622) and iPad 13-inch (2064×2752)",
        "iPhone Duo foldable screenshots for the outer (1398×2034) and inner (2007×2853) displays",
        "Google Play phone, 7-inch and 10-inch tablet screenshots and 1024×500 feature graphic",
        "Strips alpha channel: true 24-bit RGB PNG output",
        "Auto-detects device from image resolution",
        "Exports a ready-to-upload ZIP by store, language and device",
        "Generates iOS and Android app icons for Flutter, React Native and Expo",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AppShell />
      <SeoGuide />
    </>
  );
}
