import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/catalog";

/**
 * Generated plant artwork.
 *
 * There is no photography yet, and a plant catalogue that renders grey
 * placeholder boxes cannot be judged for layout, density or hierarchy. Each
 * plant instead renders a botanical silhouette on a warm ground, seeded by id
 * so a given plant always draws the same way and a grid of them does not look
 * like one plant repeated. When photography arrives it replaces this behind the
 * same props.
 *
 * Aspect ratio is owned by the caller and locked to 4:5 portrait in every grid,
 * so swapping in real photography cannot shift the layout.
 */

type Props = {
  product: Product;
  kind?: "catalog" | "lifestyle";
  className?: string;
  sizes?: string;
  priority?: boolean;
  ground?: "light" | "dark";
};

export function PlantImage({
  product,
  kind = "catalog",
  className,
  sizes,
  priority,
  ground = "light",
}: Props) {
  const image = product.images.find((i) => i.kind === kind) ?? product.images[0];

  if (image) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        priority={priority}
        quality={82}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <BotanicalPlate
      seed={product.id}
      shape={inferLeafShape(product)}
      ground={ground}
      className={className}
    />
  );
}

/** Small deterministic hash so the same plant always draws the same way. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type LeafShape = "broad" | "blade" | "split" | "frond";

const leafPaths: Record<Exclude<LeafShape, "frond">, string> = {
  broad: "M0 0 C34 -46 36 -128 0 -186 C-36 -128 -34 -46 0 0 Z",
  // Narrow upright blade — snake plant, spider plant.
  blade: "M0 0 C16 -56 18 -150 0 -214 C-18 -150 -16 -56 0 0 Z",
  // Notched, monstera-like. The wedges are cut into the outline itself so no
  // background-coloured overlay is needed on top of a gradient.
  split:
    "M0 0 C22 -28 32 -58 34 -80 L10 -92 L36 -100 C38 -122 35 -142 28 -160 " +
    "L6 -168 L26 -178 C20 -192 11 -202 0 -208 C-11 -202 -20 -192 -26 -178 " +
    "L-6 -168 L-28 -160 C-35 -142 -38 -122 -36 -100 L-10 -92 L-34 -80 " +
    "C-32 -58 -22 -28 0 0 Z",
};

/**
 * Shape is inferred from the plant's own botanical name — placeholder art only,
 * and the whole function disappears when real photography lands.
 */
export function inferLeafShape(
  product: Pick<Product, "nameBotanical" | "t">,
): LeafShape {
  const name = `${product.t.en.name} ${product.nameBotanical}`.toLowerCase();
  // Pinnate / many-leafleted: ferns, palms, ZZ, frangipani.
  if (/fern|palm|nephrolepis|chamaedorea|asplenium|plumeria|zamioculcas|zz plant/.test(name))
    return "frond";
  if (/snake|dracaena|spider|chlorophytum/.test(name)) return "blade";
  if (/monstera|pothos|epipremnum|philodendron/.test(name)) return "split";
  return "broad";
}

/**
 * Palettes drawn from the token ramp. Warm grounds under foliage — a plant
 * photographed or drawn on pure white loses its edge definition.
 */
const lightSchemes = [
  { bg: "oklch(0.972 0.012 133)", bgTo: "oklch(0.943 0.022 132)", leaf: "oklch(0.672 0.065 128)", leafAlt: "oklch(0.586 0.062 129)", pot: "oklch(0.663 0.117 39)", potRim: "oklch(0.566 0.113 38)" },
  { bg: "oklch(0.968 0.010 80)", bgTo: "oklch(0.930 0.022 78)", leaf: "oklch(0.586 0.062 129)", leafAlt: "oklch(0.489 0.055 132)", pot: "oklch(0.503 0.099 37)", potRim: "oklch(0.424 0.081 36)" },
  { bg: "oklch(0.968 0.012 45)", bgTo: "oklch(0.933 0.028 42)", leaf: "oklch(0.489 0.055 132)", leafAlt: "oklch(0.398 0.047 135)", pot: "oklch(0.822 0.046 74)", potRim: "oklch(0.663 0.070 60)" },
  { bg: "oklch(0.972 0.012 133)", bgTo: "oklch(0.888 0.038 131)", leaf: "oklch(0.752 0.062 129)", leafAlt: "oklch(0.586 0.062 129)", pot: "oklch(0.374 0.015 56)", potRim: "oklch(0.281 0.013 54)" },
];

const darkSchemes = [
  { bg: "oklch(0.262 0.032 143)", bgTo: "oklch(0.206 0.028 144)", leaf: "oklch(0.489 0.055 132)", leafAlt: "oklch(0.398 0.047 135)", pot: "oklch(0.503 0.099 37)", potRim: "oklch(0.424 0.081 36)" },
];

export function BotanicalPlate({
  seed,
  shape = "broad",
  ground = "light",
  showPot = true,
  className,
}: {
  seed: string;
  shape?: LeafShape;
  ground?: "light" | "dark";
  /** Backdrops want foliage only — a pot blown up to hero scale reads as a
   *  brown slab rather than as a plant. */
  showPot?: boolean;
  className?: string;
}) {
  const h = hash(seed);
  const schemes = ground === "dark" ? darkSchemes : lightSchemes;
  const scheme = schemes[h % schemes.length];
  const gradientId = `plate-${seed.replace(/[^a-z0-9-]/gi, "")}-${ground}`;

  const leafCount = shape === "blade" ? 5 + (h % 3) : 5 + (h % 4);
  const spread = shape === "blade" ? 70 + (h % 24) : 118 + (h % 40);

  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = leafCount === 1 ? 0.5 : i / (leafCount - 1);
    const angle = -spread / 2 + t * spread;
    // Outer leaves sit lower and shorter — reads as a plant, not a fan.
    const scale = 0.72 + 0.28 * (1 - Math.abs(t - 0.5) * 2) + ((h >> i) % 7) / 100;
    const back = i % 2 === 1;
    return { angle, scale, back, key: i };
  });

  return (
    <div className={cn("absolute inset-0", className)} aria-hidden="true">
      {/* Bottom-anchored: in a frame narrower than 4:5 the overflow crops the
          top of the foliage rather than cutting the pot in half. */}
      <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={scheme.bg} />
            <stop offset="100%" stopColor={scheme.bgTo} />
          </linearGradient>
        </defs>

        <rect width="400" height="500" fill={`url(#${gradientId})`} />

        {/* Foliage fans out from the soil line. Without the pot it sits
            lower so the frame fills with leaves. */}
        <g transform={`translate(200 ${showPot ? 372 : 470})`}>
          {leaves
            .sort((a, b) => Number(b.back) - Number(a.back))
            .map((leaf) => (
              <g key={leaf.key} transform={`rotate(${leaf.angle}) scale(${leaf.scale})`}>
                {shape === "frond" ? (
                  <Frond fill={leaf.back ? scheme.leafAlt : scheme.leaf} back={leaf.back} />
                ) : (
                  <>
                    <path
                      d={leafPaths[shape]}
                      fill={leaf.back ? scheme.leafAlt : scheme.leaf}
                      opacity={leaf.back ? 0.75 : 1}
                    />
                    <path
                      d={shape === "blade" ? "M0 -6 L0 -198" : "M0 -6 L0 -170"}
                      stroke={scheme.bg}
                      strokeOpacity="0.35"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </>
                )}
              </g>
            ))}
        </g>

        {/* Pot — a slightly tapered vessel with a rim, drawn over the stems. */}
        {showPot ? (
          <>
            <path
              d="M132 366 H268 L252 470 A10 10 0 0 1 242 478 H158 A10 10 0 0 1 148 470 Z"
              fill={scheme.pot}
            />
            <rect x="126" y="352" width="148" height="22" rx="6" fill={scheme.potRim} />
            <path
              d="M148 470 H252 L250 480 A10 10 0 0 1 240 478 H160 A10 10 0 0 1 150 480 Z"
              fill={scheme.potRim}
              opacity="0.5"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}

/** A rachis with paired leaflets — ferns, palms, ZZ, frangipani. */
function Frond({ fill, back }: { fill: string; back: boolean }) {
  const leaflets = Array.from({ length: 9 }, (_, i) => ({
    y: -32 - i * 19,
    len: 30 - i * 2.4,
    key: i,
  }));

  return (
    <g opacity={back ? 0.75 : 1}>
      <path d="M0 0 L0 -204" stroke={fill} strokeWidth="6" strokeLinecap="round" fill="none" />
      {leaflets.map((leaflet) => (
        <g key={leaflet.key}>
          <ellipse
            cx={leaflet.len / 2}
            cy={leaflet.y}
            rx={leaflet.len / 2}
            ry="7"
            fill={fill}
            transform={`rotate(-28 0 ${leaflet.y})`}
          />
          <ellipse
            cx={-leaflet.len / 2}
            cy={leaflet.y}
            rx={leaflet.len / 2}
            ry="7"
            fill={fill}
            transform={`rotate(28 0 ${leaflet.y})`}
          />
        </g>
      ))}
    </g>
  );
}
