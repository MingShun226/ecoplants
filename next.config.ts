import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Three locales across a catalogue of dynamic routes. Compile-time route
  // checking materially reduces broken-link defects.
  typedRoutes: true,

  // Cache Components stays off until the Supabase data layer lands. Turning it
  // on now would force Suspense boundaries around mock data that is about to be
  // replaced; the `use cache` call sites will be marked in lib/data when the
  // real queries arrive.
  // cacheComponents: true,

  images: {
    formats: ["image/avif", "image/webp"],
    // Plant photography carries the brand, so the quality ceiling is higher
    // than the Next.js default of 75.
    qualities: [70, 82, 92],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
};

export default withNextIntl(nextConfig);
