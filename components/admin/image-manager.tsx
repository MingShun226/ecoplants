"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteProductImage,
  moveProductImage,
  setPrimaryImage,
  updateImageMeta,
  uploadProductImage,
  type ImageKind,
} from "@/lib/admin/image-actions";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/admin/enums";
import type { ProductImageRow, VariantRow } from "@/lib/admin/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Product photography.
 *
 * Two decisions actually matter and both are made on the tile: which photo is
 * the cover, and which size it is a photo of. Everything else — alt text, shot
 * kind — is real but rarely changed, so it sits behind a disclosure rather than
 * competing with the picture for attention. An earlier version put six controls
 * under every thumbnail; at nine photos that was fifty-four controls on one
 * screen, which is a form, not a gallery.
 *
 * Which size a photo belongs to is chosen once, before upload, because photos
 * arrive in batches and a batch is nearly always of the same thing.
 */
const KINDS: { value: ImageKind; label: string }[] = [
  { value: "catalog", label: "Catalogue — plain background" },
  { value: "lifestyle", label: "Lifestyle — styled in a room" },
  { value: "detail", label: "Detail — close on a leaf or pot" },
  { value: "scale", label: "Scale — next to something familiar" },
];

const ALL_VARIANTS = "__all__";

/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * A photo off a phone is routinely 4000px wide and 6 MB, which the 5 MB limit
 * refuses outright — leaving the one person who has the photographs unable to
 * put them in the shop. Nothing on the storefront is served larger than about
 * 1200px, so the pixels being refused were never going to be seen.
 *
 * `imageOrientation: "from-image"` is not optional. A canvas ignores the EXIF
 * rotation flag that phones write instead of rotating the pixels, so without it
 * every portrait photo taken on a phone uploads on its side.
 *
 * Every failure path returns the original file. A photo that uploads at full
 * size is a slow page; a photo that does not upload is not a product.
 */
const MAX_EDGE = 2000;
const SHRINK_ABOVE_BYTES = 1_200_000;

async function shrink(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small in both senses — re-encoding would only lose detail.
    if (scale === 1 && file.size <= SHRINK_ABOVE_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    // A hand-optimised JPEG can beat this. Keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function ImageManager({
  productId,
  productRef,
  productName,
  images,
  variants,
}: {
  productId: string;
  productRef: string;
  productName: string;
  images: ProductImageRow[];
  variants: VariantRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadFor, setUploadFor] = useState(ALL_VARIANTS);
  const [progress, setProgress] = useState("");

  const remaining = MAX_IMAGES_PER_PRODUCT - images.length;
  const full = remaining <= 0;

  const upload = (files: FileList | null) => {
    if (!files?.length || full) return;
    setError(null);

    const chosen = Array.from(files);
    // Refused here rather than one-by-one at the server, so the operator is
    // told the batch is too big before any of it uploads.
    if (chosen.length > remaining) {
      setError(
        `Room for ${remaining} more photo${remaining === 1 ? "" : "s"}, and you chose ${chosen.length}.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    start(async () => {
      // One at a time, so a single rejected file reports its own reason
      // instead of failing the batch silently.
      for (const [i, original] of chosen.entries()) {
        setProgress(chosen.length > 1 ? `${i + 1} of ${chosen.length}` : "");
        const file = await shrink(original);

        const form = new FormData();
        form.set("file", file);
        form.set("productId", productId);
        form.set("productRef", productRef);
        form.set("kind", "catalog");
        if (uploadFor !== ALL_VARIANTS) form.set("variantId", uploadFor);

        const result = await uploadProductImage(form);
        if (!result.ok) {
          // Named by the file the operator chose, not by the resized copy.
          setError(`${original.name}: ${result.error}`);
          break;
        }
      }
      setProgress("");
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <ImageTile
              key={image.id}
              image={image}
              index={index}
              total={images.length}
              productId={productId}
              productName={productName}
              variants={variants}
            />
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="rounded-lg border border-border-default bg-surface-sunken px-4 py-3 text-[12px] leading-relaxed text-text-secondary">
          That is all {MAX_IMAGES_PER_PRODUCT} photos. Delete one to add another.
        </p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-7 text-center transition-colors",
            dragging ? "border-leaf-700 bg-leaf-50" : "border-border-default bg-surface-sunken",
          )}
        >
          <ImagePlus className="size-5 text-text-tertiary" aria-hidden="true" />
          <p className="mt-3 text-[13px]">
            {images.length === 0 ? "No photos yet" : "Add another photo"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
            Drag them in, or choose files. JPEG, PNG, WebP or AVIF. Anything large is
            resized in the browser first, so photos straight off a phone are fine.
          </p>

          {/* Asked before the upload, not after: a batch of photos is almost
              always of the same size, so this is one decision instead of one
              per file. */}
          {variants.length > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Label htmlFor={`upload-for-${productId}`} className="text-[11px] text-text-tertiary">
                These are photos of
              </Label>
              <Select value={uploadFor} onValueChange={setUploadFor}>
                <SelectTrigger
                  id={`upload-for-${productId}`}
                  className="h-8 w-44 rounded-sm bg-surface text-[13px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VARIANTS}>Every size</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="capitalize">
                      {v.sizeKey} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(e) => upload(e.target.files)}
            className="hidden"
            id={`upload-${productId}`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4 gap-2"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {pending ? `Uploading… ${progress}`.trim() : "Choose files"}
          </Button>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-tertiary">
        These run in gallery order on the product page, and the first one is the{" "}
        <strong className="font-medium text-text-primary">cover</strong> — what the shop
        grid and the basket show. Until a product has one, the storefront draws generated
        artwork instead. A photo marked for one size only appears when a shopper picks
        that size; the rest show for every size.
      </p>
    </div>
  );
}

function ImageTile({
  image,
  index,
  total,
  productId,
  productName,
  variants,
}: {
  image: ProductImageRow;
  index: number;
  total: number;
  productId: string;
  productName: string;
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ImageKind>(image.kind);
  const [variantId, setVariantId] = useState(image.variantId ?? ALL_VARIANTS);
  const [alt, setAlt] = useState(image.alt);
  const [saved, setSaved] = useState(false);

  const dirty =
    kind !== image.kind || variantId !== (image.variantId ?? ALL_VARIANTS) || alt !== image.alt;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const variantLabel =
    image.variantId === null
      ? "Every size"
      : (variants.find((v) => v.id === image.variantId)?.sizeKey ?? "One size");

  return (
    <li className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
      <div className="group relative aspect-square bg-surface-sunken">
        <Image
          src={image.src}
          alt={image.alt || productName}
          fill
          sizes="(max-width: 640px) 50vw, 220px"
          className="object-cover"
        />

        {image.isPrimary ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-950 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ink-50">
            <Star className="size-2.5 fill-current" aria-hidden="true" />
            Cover
          </span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setPrimaryImage(image.id, productId))}
            className="absolute left-2 top-2 rounded-full bg-canvas/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-text-secondary opacity-0 backdrop-blur-sm transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
          >
            Make cover
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          aria-label="Delete photo"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-canvas/90 text-text-tertiary opacity-0 backdrop-blur-sm transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>

        {/* Order is the gallery order on the shop, and the photo at the front
            is the cover — so moving one to the front makes it the cover, and
            there is only ever one order to reason about. Arrows rather than
            dragging: this has to work on a phone and from a keyboard, and
            native drag-and-drop does neither. */}
        {total > 1 ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink-950/70 to-transparent px-2 pb-2 pt-6 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              disabled={pending || index === 0}
              onClick={() => run(() => moveProductImage(image.id, productId, "back"))}
              aria-label="Move photo earlier"
              className="flex size-7 items-center justify-center rounded-full bg-canvas/90 text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <span className="numeric rounded-full bg-canvas/90 px-2 py-0.5 text-[10px] text-text-tertiary backdrop-blur-sm">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              disabled={pending || index === total - 1}
              onClick={() => run(() => moveProductImage(image.id, productId, "forward"))}
              aria-label="Move photo later"
              className="flex size-7 items-center justify-center rounded-full bg-canvas/90 text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary disabled:opacity-30"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {/* Deleting is irreversible and the bytes go with the row, so the
            confirmation covers the photo itself rather than appearing as a
            button somewhere below it. */}
        {confirming ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/80 px-3 text-center backdrop-blur-sm">
            <p className="text-[12px] leading-snug text-ink-50">Delete this photo?</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => deleteProductImage(image.id))}
              >
                {pending ? "Deleting…" : "Delete"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center justify-between gap-2 px-3 py-2 text-left text-[11px] text-text-tertiary transition-colors hover:text-text-primary"
        >
          <span className="truncate capitalize">{variantLabel}</span>
          <ChevronDown
            className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <div className="flex flex-col gap-3 border-t border-border-subtle px-3 py-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`variant-${image.id}`} className="text-[11px]">
                Shows for
              </Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger id={`variant-${image.id}`} className="h-8 rounded-sm text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VARIANTS}>Every size</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="capitalize">
                      {v.sizeKey} only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`kind-${image.id}`} className="text-[11px]">
                Shot
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ImageKind)}>
                <SelectTrigger id={`kind-${image.id}`} className="h-8 rounded-sm text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`alt-${image.id}`} className="text-[11px]">
                Alt text
              </Label>
              <Input
                id={`alt-${image.id}`}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder={productName}
                className="h-8 rounded-sm text-[12px]"
              />
              <p className="text-[10.5px] leading-relaxed text-text-tertiary">
                Describe the plant, not the photo. Blank falls back to the product name.
              </p>
            </div>

            <Button
              size="sm"
              disabled={pending || !dirty}
              onClick={() =>
                run(async () => {
                  const r = await updateImageMeta(image.id, {
                    kind,
                    variantId: variantId === ALL_VARIANTS ? null : variantId,
                    alt,
                  });
                  if (r.ok) {
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 2000);
                  }
                  return r;
                })
              }
            >
              {pending ? "Saving…" : saved ? "Saved" : "Save"}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
