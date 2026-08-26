import type Link from "next/link";

/**
 * `typedRoutes` checks `<Link href>` against the routes it found on disk, which
 * only works when the href is a literal it can see. Panel screens assemble
 * their links at runtime — a view chip carries the current search term, a
 * product row carries a ref — so the type widens to `string` and the check has
 * nothing left to check.
 *
 * `adminHref()` is where that widening is acknowledged in one place rather than
 * scattered as inline casts. It is a compile-time assertion and nothing more;
 * the paths themselves are still ordinary strings at runtime.
 *
 * Same idea as the `RuntimeRoute` cast in `components/features/filter-bar.tsx`,
 * which does this for `router.replace`.
 */
type LinkHref = React.ComponentProps<typeof Link>["href"];

export function adminHref(path: string): LinkHref {
  return path as LinkHref;
}
