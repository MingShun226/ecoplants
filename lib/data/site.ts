/**
 * Brand-level facts that appear in more than one place and that a client should
 * be able to change without touching a component. Anything with copy in it
 * lives in messages/*.json instead — this file holds only values.
 *
 * Commercial levers are NOT here. The free-delivery threshold, the delivery
 * fee, the guarantee period and the WhatsApp number moved to the
 * `shop_settings` table so the shop owner can change them from the admin panel
 * without a deploy — read them through `lib/data/settings.ts`. What is left is
 * structural: things that are a code change anyway, because a route or a
 * message key has to exist for them.
 */
export const site = {
  name: "EcoPlants",

  nav: [
    { href: "/category/indoor", key: "indoor" },
    { href: "/category/outdoor", key: "outdoor" },
    { href: "/category/pet-safe", key: "petSafe" },
    { href: "/category/beginner", key: "beginner" },
  ],
} as const;
