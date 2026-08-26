import { Wordmark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

export function LogoLink() {
  return (
    <Link href="/" className="shrink-0" aria-label="EcoPlants">
      <Wordmark className="h-7 w-auto md:h-8" />
    </Link>
  );
}
