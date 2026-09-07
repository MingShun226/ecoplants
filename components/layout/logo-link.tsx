import { Wordmark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

export function LogoLink() {
  return (
    // `flex items-center`, not a bare link.
    //
    // `Wordmark` is an inline-flex, so inside an inline link it sits on the
    // text baseline and the link's box grows to leave room for descenders that
    // nothing in it has. That empty strip below pushed the mark visibly above
    // the search, account and cart icons it shares the row with. As a flex
    // container the mark is a block-level child, the baseline stops applying,
    // and the row centres on the same line.
    <Link href="/" className="flex shrink-0 items-center" aria-label="EcoPlants">
      <Wordmark className="h-7 w-auto md:h-8" />
    </Link>
  );
}
