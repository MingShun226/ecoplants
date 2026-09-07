/**
 * Preparing a picture in the browser, before it is uploaded.
 *
 * Shared by the two things that upload one: a plant's photographs and a
 * category's cover. It lived beside the product uploader, which is why the
 * category cover never got it — and why a cover straight out of an image
 * generator failed with a 500 rather than an explanation. Next caps a server
 * action's body at 1 MB by default, well under what the action itself was
 * checking for, so the file never reached the code that would have said so.
 *
 * No React, no server imports: it is a canvas and a File, and both callers are
 * client components.
 */

/**
 * Put every photo on the same canvas before it is uploaded.
 *
 * Two jobs, done in one pass because both need the pixels decoded anyway.
 *
 * **One shape.** The storefront draws every photograph in a 4:5 frame. Left to
 * themselves, uploads are whatever shape the camera or the supplier's size
 * guide happened to be, so one plant filled its frame and the next sat in a
 * band of empty space — and a row of cards read as a jumble rather than a
 * shelf. Every upload is put on a 1600x2000 canvas.
 *
 * How it gets there depends on what it would cost. A phone photo is around
 * 3:4, a hair narrower than 4:5, and squaring it up costs six percent off the
 * top and bottom of a studio backdrop — nothing anybody will miss. A supplier's
 * size guide is landscape, and squaring *that* up costs a quarter of its width,
 * which is where the measurements are. So the rule is the loss, not the kind:
 * crop when it costs less than an eighth of the picture, pad when it would cost
 * more. See `CROP_BUDGET`.
 *
 * Padding uses the photo's own background colour, sampled from its corners, so
 * on the white and grey a catalogue shot actually uses it cannot be seen.
 *
 * **Fewer pixels.** A photo off a phone is routinely 4000px wide and 6 MB,
 * which the 5 MB limit refuses outright — leaving the one person who has the
 * photographs unable to put them in the shop. Nothing on the storefront is
 * served larger than about 1200px, so the pixels being refused were never going
 * to be seen.
 *
 * `imageOrientation: "from-image"` is not optional. A canvas ignores the EXIF
 * rotation flag that phones write instead of rotating the pixels, so without it
 * every portrait photo taken on a phone uploads on its side.
 *
 * Every failure path returns the original file. An oddly shaped photo is a
 * blemish; a photo that will not upload is not a product.
 */
const TARGET_W = 1600;
const TARGET_H = 2000;
const TARGET_RATIO = TARGET_W / TARGET_H;

/**
 * The most of a picture squaring it up may cost before it is padded instead.
 *
 * An eighth. Below that the loss is backdrop — the top of a studio sweep, the
 * floor under a pot — and cropping is invisibly better than bars down the
 * sides. Above it the picture is a different shape on purpose, and the part
 * being cut is the part it was taken for.
 */
const CROP_BUDGET = 0.125;

/** How far two corners may differ and still count as one flat backdrop. */
const FLAT_BACKDROP_TOLERANCE = 12;

/** What squaring this picture up to the canvas would cost, as a fraction. */
function cropCost(width: number, height: number): number {
  const ratio = width / height;
  // Narrower than the canvas loses height; wider loses width.
  return ratio < TARGET_RATIO ? 1 - ratio / TARGET_RATIO : 1 - TARGET_RATIO / ratio;
}

/**
 * The colour to pad with: the photo's own backdrop where it has one.
 *
 * Corners are sampled rather than the average of the whole picture, which on a
 * plant would return a muddy green. Where the corners disagree — a lifestyle
 * shot with a room in it — there is no backdrop to match, and white is the
 * honest choice over a colour that belongs to no part of the image.
 */
function backdropOf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): string {
  try {
    const corners = [
      [x + 1, y + 1],
      [x + w - 2, y + 1],
      [x + 1, y + h - 2],
      [x + w - 2, y + h - 2],
    ].map(([cx, cy]) => Array.from(ctx.getImageData(cx, cy, 1, 1).data.slice(0, 3)));

    const mean = [0, 1, 2].map((i) => corners.reduce((sum, c) => sum + c[i], 0) / corners.length);
    const flat = corners.every((c) => c.every((v, i) => Math.abs(v - mean[i]) <= FLAT_BACKDROP_TOLERANCE));

    return flat ? `rgb(${mean.map(Math.round).join(",")})` : "#ffffff";
  } catch {
    // A cross-origin source would taint the canvas. Never happens for a local
    // file, but the read is not worth throwing an upload away over.
    return "#ffffff";
  }
}

export async function standardise(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return file;
    }

    // `max` fills the canvas and lets the overflow fall off the edges; `min`
    // fits the whole picture inside and leaves bars. Which one is chosen is the
    // whole of the decision above.
    const crops = cropCost(bitmap.width, bitmap.height) <= CROP_BUDGET;
    const scale = crops
      ? Math.max(TARGET_W / bitmap.width, TARGET_H / bitmap.height)
      : Math.min(TARGET_W / bitmap.width, TARGET_H / bitmap.height);

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    // Centred either way: negative offsets crop evenly, positive ones pad evenly.
    const x = Math.round((TARGET_W - w) / 2);
    const y = Math.round((TARGET_H - h) / 2);

    // Drawn first so the backdrop can be read off the photo itself, then the
    // bars are filled around it. One canvas, one decode.
    ctx.drawImage(bitmap, x, y, w, h);
    bitmap.close();

    if (w < TARGET_W || h < TARGET_H) {
      ctx.fillStyle = backdropOf(ctx, x, y, w, h);
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillRect(0, 0, TARGET_W, TARGET_H);
      ctx.globalCompositeOperation = "source-over";
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    // Unlike the old size-only pass, the result is kept even when it is the
    // larger file. Its whole point is the shape, and the original does not
    // have it.
    if (!blob) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
