"use client";

import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/brand/primitives";
import { usePathname } from "@/i18n/navigation";
import { useShopSettings } from "@/components/features/settings-provider";
import { whatsappUrl } from "@/lib/data/settings";
import { cn } from "@/lib/utils";

/**
 * WhatsApp is the single most-used platform in Malaysia, so pre-sale advice
 * gets a permanent entry point rather than living on a contact page.
 *
 * The PDP carries a sticky add-to-cart bar on mobile, so on that route the FAB
 * lifts clear of it. Everywhere else it sits at the normal bottom offset
 * instead of floating in the middle of the screen.
 */
export function WhatsAppFab() {
  const settings = useShopSettings();
  const t = useTranslations("whatsapp");
  const ta = useTranslations("actions");
  const pathname = usePathname();
  const hasStickyBar = pathname.startsWith("/plants/");

  return (
    <a
      href={whatsappUrl(settings.whatsappNumber, t("greeting"))}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-leaf-800 py-3 pl-3.5 pr-4",
        "text-sm font-medium text-ink-50 shadow-overlay transition-colors duration-300 hover:bg-leaf-700",
        "md:bottom-6 md:right-6",
        hasStickyBar ? "bottom-24" : "bottom-5",
      )}
    >
      <WhatsAppIcon className="size-5" />
      <span className="hidden sm:inline">{ta("askOnWhatsApp")}</span>
      <span className="sr-only sm:hidden">{ta("askOnWhatsApp")}</span>
    </a>
  );
}
