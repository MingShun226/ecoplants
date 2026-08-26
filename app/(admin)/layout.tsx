import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "../globals.css";

/**
 * A second root layout, alongside `app/[locale]/layout.tsx`.
 *
 * The panel is not a localised surface (ADR 0006), so it sits outside the
 * `[locale]` segment and owns its own <html>. `proxy.ts` excludes `/admin` from
 * locale negotiation to match.
 *
 * `admin-mono` desaturates the clay ramp to grey across the whole subtree and
 * `admin-type` swaps the display face to Lora — both are token overrides in
 * globals.css, so no component knows it is being rendered in the panel.
 */
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EcoPlants admin", template: "%s · EcoPlants admin" },
  // Never index the panel, and never follow a link out of it.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${inter.variable}`}>
      <body className="admin-mono admin-type min-h-dvh antialiased">{children}</body>
    </html>
  );
}
