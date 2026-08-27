# Image prompts

Prompts for generating the site's imagery. Written against the slots that
actually exist in the code, so the output drops straight in.

## What the site asks for

| Slot | Where | Ratio | Count | Status |
| --- | --- | --- | --- | --- |
| `catalog` | Plant cards, cart drawer, quiz results, PDP | **4:5** portrait | 14 (one per plant) | empty |
| `lifestyle` | PDP gallery | 4:5 | 1–2 per plant | empty |
| `detail` | PDP gallery | 4:5 | 1 per plant | empty |
| `scale` | PDP gallery | 4:5 | 1 per plant | empty |
| Category image | Admin only — **not rendered on the storefront yet** | 4:3 | 7 | empty |
| Open Graph card | WhatsApp / Facebook / X link previews | 1.91:1 (1200×630) | 1 | **route does not exist** |

Two gaps worth knowing before you spend time generating:

- **Category images upload but display nowhere.** `categories.image_path` is
  written by the admin and read back by the admin. The storefront's category
  list is a hardcoded array in `lib/data/queries.ts` with no image field, so
  nothing renders. Wiring it is a small change — worth doing before generating
  seven images.
- **There is no OG image.** `app/[locale]/layout.tsx` sets `openGraph.title`
  and `description` but no `images`, so a shared link shows a bare text card.
  This is the single highest-value image on the list: every WhatsApp share of
  the shop currently looks unfinished.

Everything renders through `object-cover`, so anything off-ratio is cropped
from the centre. Generate at the stated ratio.

## House style

Paste this into every prompt. It is the site's palette and light, so images
made with it sit on the page instead of on top of it.

> Warm natural daylight, soft and directional, as if from a large window on an
> overcast tropical morning. Muted earthy palette: cream `#F7F3EC`, warm sand
> `#F0E6D8`, terracotta `#CF785C`, sage `#A2B78D`, deep green `#556746`.
> Matte surfaces, no gloss, no plastic sheen. Shallow depth of field. Calm,
> editorial, unhurried. No text, no logos, no watermarks, no faces.
> Photographic, not illustrated. Shot on a 50mm lens at f/2.8.

Negative prompt, for tools that take one:

> harsh flash, blue or fluorescent cast, oversaturated greens, HDR, glossy
> plastic pots, cluttered background, text, watermark, logo, hands, deformed
> leaves, extra stems, cartoon, 3D render, illustration

## The four shot kinds

**`catalog`** — the workhorse. It is what the card shows, so it has to read at
120px wide.

> [PLANT] in a matte terracotta pot, centred, full plant visible from soil line
> to top leaf, straight-on eye-level view, plain seamless cream `#F7F3EC`
> background, soft shadow pooling at the base. Product photography, 4:5
> portrait. [HOUSE STYLE]

**`lifestyle`** — the plant in a Malaysian home. This is where the shop stops
looking like a catalogue.

> [PLANT] in a matte terracotta pot on a rattan stool beside a window with
> white sheer curtains, in a bright Kuala Lumpur apartment. Louvred window,
> terrazzo floor, a rattan basket, a stack of books. Late morning light.
> Lived-in, not styled. 4:5 portrait. [HOUSE STYLE]

Swap the setting per plant — a balcony with a laundry rack and a monsoon sky
for outdoor plants, a bathroom shelf for ferns, a kitchen counter for the
small ones. Repeating one room across fourteen plants reads as a template.

**`detail`** — macro. Sells the thing photographs usually flatten.

> Extreme close-up of [LEAF FEATURE], filling the frame, backlit so the veins
> glow through, water droplets on the surface, background falling to soft
> blur. Macro photography, 4:5 portrait. [HOUSE STYLE]

**`scale`** — answers "how big is it, really", which is the question the size
picker raises and words never quite settle.

> [PLANT] in a matte terracotta pot standing on a pale wooden floor beside a
> plain wooden dining chair for scale, the plant reaching [HEIGHT]. Full room
> corner visible, cream wall. Straight-on, no perspective distortion. 4:5
> portrait. [HOUSE STYLE]

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
| Boston Fern | a Nephrolepis exaltata in a hanging pot, dense arching finely-divided fronds cascading well below the rim | overlapping pinnae along an arching frond, translucent in backlight |
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

## Category images (4:3)

| Slug | Prompt |
| --- | --- |
| `new` | A small cluster of freshly potted young plants in nursery-grade terracotta on a concrete potting bench, soil still dark and damp, a watering can just out of frame. [HOUSE STYLE] |
| `outdoor` | A Malaysian apartment balcony in late afternoon: bougainvillea and frangipani in large terracotta pots against a railing, laundry line, monsoon clouds building over rooftops. [HOUSE STYLE] |
| `indoor` | A corner of a bright KL apartment with three plants of different heights beside a louvred window, sheer curtain moving, terrazzo floor. [HOUSE STYLE] |
| `pet-safe` | A ginger cat asleep on a rattan mat beside a Bird's Nest Fern and a Parlour Palm in terracotta pots, warm floor light. [HOUSE STYLE] |
| `beginner` | A single Snake Plant in a terracotta pot on a plain side table against a cream wall, nothing else in frame, generous empty space. [HOUSE STYLE] |
| `pots` | An overhead flat-lay of empty pots on cream linen: matte terracotta, cream glazed ceramic, grey fibreclay, in graduating sizes, arranged loosely. [HOUSE STYLE] |
| `care` | An overhead flat-lay on cream linen: a mound of chunky aroid mix, a small brass trowel, a bag of slow-release fertiliser pellets, pruning snips, a moisture meter. [HOUSE STYLE] |

## Open Graph card (1200×630)

The one to generate first.

> A wide shot of a Monstera Deliciosa and a Snake Plant in matte terracotta
> pots against a deep green wall `#132014`, lit from the left, with generous
> empty space on the right two-thirds of the frame for text to be overlaid.
> Cinematic, calm, editorial. 1.91:1 landscape. [HOUSE STYLE]

Leave the right side empty — the wordmark and tagline get composited over it.
Then add `images` to `openGraph` in `app/[locale]/layout.tsx`, or add an
`app/opengraph-image.tsx` route.

## One caution on `catalog` shots

A generated `catalog` image is a picture of a plant that does not exist. It is
the image the customer decides on, and the plant that arrives will not match
it — different leaf count, different form, different pot. That is a refund
conversation every time, and under the Consumer Protection Act 1999 a product
image that misrepresents what ships is a misleading representation, not a
stylistic choice.

So: **shoot `catalog` from real stock.** A phone camera, a window and a sheet
of cream card gets closer to this house style than any prompt, because it is
photographing the actual plant.

Generate the rest freely — `lifestyle` sets a mood rather than promising a
specific plant, `detail` shows a species trait true of every specimen, and
category headers and the OG card illustrate a collection. Those are honest.
`scale` sits in between: fine as long as the height matches the table above.
