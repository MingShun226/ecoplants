"use client";

import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteProductImage,
  setPrimaryImage,
  updateImageMeta,
  type ImageKind,
} from "@/lib/admin/image-actions";
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
 * The storefront picks an image by `kind` and falls back to the first one, so
 * the two things that actually matter here are which shot is primary and what
 * kind each one is. Everything else is housekeeping.
 *
 * Uploads go through a server action rather than straight from the browser, so
 * the file is size- and type-checked before it reaches storage and the
 * `product_images` row is written in the same call. A photo in the bucket with
 * no row is invisible to the shop and impossible to find later.
 */
const KINDS: { value: ImageKind; label: string; hint: string }[] = [
  { value: "catalog", label: "Catalogue", hint: "Plain background. The card and grid shot." },
  { value: "lifestyle", label: "Lifestyle", hint: "In a room, styled. Used on the product page." },
  { value: "detail", label: "Detail", hint: "Close on a leaf, variegation, or the pot." },
  { value: "scale", label: "Scale", hint: "Next to something familiar, so size reads." },
];

const ALL_VARIANTS = "__all__";

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

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    start(async () => {
      // One at a time, so a single rejected file reports its own reason
      // instead of failing the batch silently.
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("productId", productId);
        form.set("productRef", productRef);
        form.set("kind", "catalog");

        const { uploadProductImage } = await import("@/lib/admin/image-actions");
        const result = await uploadProductImage(form);
        if (!result.ok) {
          setError(`${file.name}: ${result.error}`);
          break;
        }
      }
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Drop target doubles as the empty state, so there is one obvious place
          to put a photo whether or not any exist yet. */}
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
          "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-leaf-700 bg-leaf-50" : "border-border-default bg-surface-sunken",
        )}
      >
        <ImagePlus className="size-5 text-text-tertiary" aria-hidden="true" />
        <p className="mt-3 text-[13px]">
          {images.length === 0 ? "No photos yet" : "Add another photo"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
          Drag one in, or choose a file. JPEG, PNG, WebP or AVIF, up to 5 MB.
        </p>

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
          {pending ? "Uploading…" : "Choose file"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed">
          {error}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              productId={productId}
              productName={productName}
              variants={variants}
            />
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-tertiary">
        The primary photo is what the shop grid and the basket show. Until a product has
        one, the storefront draws generated botanical artwork instead — which is why the
        catalogue currently looks illustrated rather than photographed.
      </p>
    </div>
  );
}

function ImageCard({
  image,
  productId,
  productName,
  variants,
}: {
  image: ProductImageRow;
  productId: string;
  productName: string;
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [kind, setKind] = useState<ImageKind>(image.kind);
  const [variantId, setVariantId] = useState(image.variantId ?? ALL_VARIANTS);
  const [alt, setAlt] = useState(image.alt);
  const [saved, setSaved] = useState(false);

  const dirty =
    kind !== image.kind ||
    variantId !== (image.variantId ?? ALL_VARIANTS) ||
    alt !== image.alt;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <li className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
      <div className="relative aspect-4/3 bg-surface-sunken">
        <Image
          src={image.src}
          alt={image.alt || productName}
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className="object-cover"
        />
        {image.isPrimary ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink-950 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ink-50">
            <Star className="size-2.5 fill-current" aria-hidden="true" />
            Primary
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`kind-${image.id}`} className="text-[11px]">
              Kind
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ImageKind)}>
              <SelectTrigger id={`kind-${image.id}`} className="h-8 rounded-sm text-[13px]">
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
            <Label htmlFor={`variant-${image.id}`} className="text-[11px]">
              Shows for
            </Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger id={`variant-${image.id}`} className="h-8 rounded-sm text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VARIANTS}>All sizes</SelectItem>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="capitalize">
                    {v.sizeKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            className="h-8 rounded-sm text-[13px]"
          />
          <p className="text-[11px] leading-relaxed text-text-tertiary">
            What a screen reader says, and what shows if the image fails. Describe the
            plant, not the photo. Blank falls back to the product name.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {!image.isPrimary ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setPrimaryImage(image.id, productId))}
              className="gap-1.5"
            >
              <Star className="size-3.5" aria-hidden="true" />
              Make primary
            </Button>
          ) : null}

          {confirming ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => run(() => deleteProductImage(image.id))}
              >
                Delete for good
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              aria-label="Delete photo"
              className="ml-auto flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
