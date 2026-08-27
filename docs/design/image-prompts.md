# Image prompts

Prompts for generating the site's imagery. Written against the slots that
actually exist in the code, and against the reference photographs in
`public/images/plants/`.

## Start here: use your own photos as references

The ten photographs in `public/images/plants/` are the most valuable asset in
this document. They are real: a working Malaysian nursery in hard midday sun —
terracotta and black poly pots on wire benches, concrete and gravel underfoot,
shade netting overhead, a hand holding a pot into frame.

Your generation tool takes up to sixteen images in `input_urls`. **Upload all
ten and attach them to every single generation.** That is what makes the output
look like your nursery instead of like a generic stock library. Nothing in the
text below matters as much as this does.

## What the site asks for

| Slot | Where | Ratio | Count | Status |
| --- | --- | --- | --- | --- |
| `catalog` | Plant cards, cart drawer, quiz results, PDP | **4:5** portrait | one per plant | empty |
| `lifestyle` | PDP gallery | 4:5 | 1–2 per plant | empty |
| `detail` | PDP gallery | 4:5 | 1 per plant | empty |
| `scale` | PDP gallery | 4:5 | 1 per plant | empty |
| Category cover | Home page tiles | 4:3 | 7 | empty, now renders |
| Open Graph card | WhatsApp / Facebook link previews | 1.91:1 (1200×630) | 1 | **route does not exist** |

Two constraints from the generation tool and the storage bucket:

- **4:5 is unavailable at 2K and 4K.** Generate product shots at **3:4 · 2K**
  and let the site crop — everything renders through `object-cover`, which
  trims from the centre.
- **The bucket caps at 5 MB** and accepts jpeg, png, webp and avif. A 4K PNG
  lands at 12–20 MB and is rejected. Convert to WebP at quality 85 first.

## House style

Paste this into every prompt, alongside the reference images.

> Bright natural daylight, the high clean light of a tropical morning. Fresh
> saturated greens against warm neutrals: cream `#F7F3EC`, warm sand `#F0E6D8`,
> terracotta `#CF785C`, pale concrete grey. Light and open throughout — pale
> grounds, soft open shadows, nothing sunk in deep shade. Real plants in real
> terracotta and black nursery pots, not styled props. Honest, unhurried,
> airy. No text, no logos, no watermarks, no faces. Photographic, not
> illustrated. 50mm at f/4, front to back sharp.

Negative prompt, if your tool takes one:

> dark, moody, low-key, heavy shadows, night, dusk, black background, muddy
> greens, blue or fluorescent cast, HDR, glossy plastic pots, text, watermark,
> logo, deformed leaves, cartoon, 3D render, illustration

Two things in there are corrections rather than preferences. **`f/4`, not
f/2.8** — your reference photos are deep-focus, everything crisp from the front
pot to the back bench, and that busy honesty is what makes them read as a real
nursery. And **the whole negative prompt exists to hold the light up**: models
drift toward moody product lighting unless told not to, and this shop is not a
moody shop.

## The four shot kinds

**`catalog`** — the workhorse. It is what the card shows, so it has to read at
120px wide.

> [PLANT] in a terracotta pot, centred, full plant visible from soil line to
> top leaf, straight-on at the plant's own height, plain seamless cream
> `#F7F3EC` background, soft open shadow at the base. Bright, evenly lit,
> nothing in shadow. Product photography, 3:4 portrait. [HOUSE STYLE]

**`lifestyle`** — where the plant lives. Your references are all nursery, which
is the more honest setting for outdoor stock; use a home only for the indoor
plants.

> [PLANT] in a terracotta pot on a galvanised wire nursery bench, other potted
> stock receding behind it, concrete floor, bright dappled light through shade
> netting. A working nursery, unstyled and slightly untidy. 3:4 portrait.
> [HOUSE STYLE]

For indoor plants instead:

> [PLANT] in a terracotta pot beside a bright window in a Malaysian apartment,
> white sheer curtain, terrazzo floor, mid-morning sun falling across the wall.
> Bright and airy, lived-in rather than styled. 3:4 portrait. [HOUSE STYLE]

**`detail`** — macro. Sells the thing photographs usually flatten.

> Extreme close-up of [LEAF FEATURE], filling the frame, bright daylight from
> above and behind so the leaf glows, background falling to soft green blur.
> Macro photography, 3:4 portrait. [HOUSE STYLE]

**`scale`** — answers "how big is it, really", which is the question the size
picker raises and words never quite settle.

> [PLANT] in a terracotta pot on a pale concrete floor beside a plain wooden
> chair for scale, the plant reaching [HEIGHT]. Bright open daylight, cream
> wall behind. Straight-on, no perspective distortion. 3:4 portrait.
> [HOUSE STYLE]

Real dimensions from the variant table, so the scale shot is honest:

| Size | Pot diameter | Plant height |
| --- | --- | --- |
| Small | 11–15cm | 20–45cm |
| Medium | 18–24cm | 50–100cm |
| Large | 26–34cm | 95–160cm |
| Hanging | 16–18cm | 35–45cm trailing |
| Moss pole | 22cm | 90cm |

## Per-plant descriptors

Drop the middle column into `[PLANT]` and the right into `[LEAF FEATURE]`.

| Plant | `[PLANT]` | `[LEAF FEATURE]` |
| --- | --- | --- |
| Aglaonema Red | a compact Aglaonema commutatum, broad lance-shaped leaves in deep green with pink-red central veins and rose speckling | the pink-red midrib bleeding into deep green, speckled margins |
| Bird's Nest Fern | an Asplenium nidus, a rosette of undivided apple-green fronds with rippled edges radiating from a dark furry centre | the rippled frond edge and the near-black central midrib |
| Boston Fern | a Nephrolepis exaltata in a hanging pot, dense arching finely-divided fronds cascading well below the rim | overlapping pinnae along an arching frond, translucent in daylight |
| Bougainvillea | a woody Bougainvillea glabra with thorny stems and dense magenta papery bracts | papery magenta bracts around tiny white tubular flowers |
| Calathea Orbifolia | a Goeppertia orbifolia, large round leaves banded in silver-green and deep green, held on upright stems | the silver-and-green banding running to a rounded leaf edge |
| Fiddle Leaf Fig | a Ficus lyrata on a single upright trunk, large leathery violin-shaped leaves with deep sunken veins | sunken veins in a thick violin-shaped leaf, matte and slightly puckered |
| Frangipani | a Plumeria rubra with thick grey branches, whorls of leaves at the tips, white-and-yellow flowers | five overlapping white petals turning yellow at the throat |
| Monstera Deliciosa | a Monstera deliciosa, large glossy heart-shaped leaves with deep splits and oval holes | a fenestration hole with the leaf edge curling through it |
| Parlour Palm | a Chamaedorea elegans, a cluster of slender green canes with fine arching pinnate fronds | fine paired leaflets along a slim green rachis |
| Baby Rubber Plant | a compact Peperomia obtusifolia, thick glossy spoon-shaped leaves on short upright red-tinged stems | a thick succulent leaf edge catching the light, deep green |
| Golden Pothos | an Epipremnum aureum trailing from a hanging pot, heart-shaped leaves marbled in gold and green | gold marbling spreading unevenly across a heart-shaped leaf |
| Snake Plant | a Dracaena trifasciata, stiff upright sword-like leaves banded dark and pale green with yellow margins | the yellow margin against grey-green cross-banding, sharp tip |
| Spider Plant | a Chlorophytum comosum in a hanging pot, arching cream-striped leaves with plantlets dangling on thin runners | a cream centre stripe running the length of an arching leaf |
| ZZ Plant | a Zamioculcas zamiifolia, upright stems of glossy dark-green waxy oval leaflets | waxy dark leaflets paired along a thick stem, near-mirror shine |

> **These fourteen are the plants in the database, and they are not the plants
> in your reference photos.** The catalogue is indoor aroids — Monstera, ZZ,
> Calathea, Fiddle Leaf. Your photographs are outdoor nursery stock: purple
> flowering shrubs trained as bonsai, juniper and conifer seedlings, hedging.
> If the photos are the real business, the catalogue needs replacing before any
> of this is worth generating. Worth settling first — see the note at the end.

## Category covers (4:3)

| Slug | Prompt |
| --- | --- |
| `new` | Freshly potted young plants in nursery terracotta on a concrete potting bench, soil still dark and damp, bright morning light, a watering can just out of frame. |
| `outdoor` | A Malaysian nursery yard in full sun: flowering shrubs and small trees in terracotta pots along a gravel path, blue sky above, everything bright and green. |
| `indoor` | A corner of a bright airy KL apartment, three plants of different heights beside a big window, white sheer curtain lifting, terrazzo floor, sunlight across the wall. |
| `pet-safe` | A ginger cat asleep on a rattan mat beside a Bird's Nest Fern and a Parlour Palm in terracotta pots, bright daylight across a pale floor. |
| `beginner` | A single Snake Plant in a terracotta pot on a plain side table against a cream wall, bright even light, generous empty space. |
| `pots` | Overhead flat-lay of empty pots on cream linen in bright daylight: terracotta, cream glazed ceramic, grey fibreclay, graduating sizes. |
| `care` | Overhead flat-lay on cream linen in bright daylight: a mound of chunky aroid mix, a brass trowel, slow-release fertiliser pellets, pruning snips, a moisture meter. |

## Open Graph card (1200×630)

The highest-value single image on the list: without it, every WhatsApp share of
the shop renders as a bare line of text.

> A bright Malaysian nursery bench in morning sun, a row of healthy potted
> plants in terracotta pots along the left third of the frame, receding into
> soft green blur. The right two-thirds is open pale background — sunlit
> concrete and cream wall — clear and unbroken for text. Airy, fresh, 1.91:1
> landscape. [HOUSE STYLE]

Leave the right side clear; the wordmark is composited over it. Then add
`images` to `openGraph` in `app/[locale]/layout.tsx`, or an
`app/opengraph-image.tsx` route.

## One caution on `catalog` shots

A generated `catalog` image is a picture of a plant that does not exist. It is
the image the customer decides on, and the plant that arrives will not match it
— different leaf count, different form, different pot. That is a refund
conversation every time, and under the Consumer Protection Act 1999 a product
image that misrepresents what ships is a misleading representation rather than
a styling choice.

**Shoot `catalog` from real stock.** You already have ten photographs proving
you can: a phone, the morning light you already work in, and a sheet of cream
card behind the pot gets you closer to this house style than any prompt,
because it is photographing the actual plant.

Generate the rest freely — `lifestyle` sets a scene, `detail` shows a species
trait true of every specimen, category covers and the OG card illustrate a
collection. Those are honest.

## The open question

The reference photographs and the database disagree about what this shop sells.

The catalogue is fourteen trendy indoor aroids. The photographs are an outdoor
ornamental nursery — flowering shrubs, conifers, trained bonsai, hedging stock,
sold in terracotta from wire benches. Those are different businesses with
different customers, different price points and different care copy.

Nothing below the catalogue level is affected — the admin, orders, delivery and
checkout do not care what the plants are. But the fourteen products, their
descriptions, their care data and every image slot in this document follow from
that answer. It is worth settling before generating fifty images against it.
