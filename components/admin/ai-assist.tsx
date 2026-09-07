"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { draftPlantDetails } from "@/lib/admin/ai-assist-actions";
import type { PlantDraft } from "@/lib/admin/ai-assist";
import { Button } from "@/components/ui/button";

/**
 * AI Assist: one button that reads the plant's photograph and drafts its
 * listing, and the wiring that carries the result to the forms below.
 *
 * The draft is never saved. It lands in the same fields an operator types into,
 * leaving each section's own Save button to commit it — so a misidentified
 * plant costs a page reload, not a correction in the live shop. That is the
 * only reason this is a context rather than a server round trip: the forms
 * already own their state, and the draft has to arrive as if it had been typed.
 */

interface AiDraftState {
  draft: PlantDraft | null;
  /**
   * Bumped on every apply, including a re-apply of the same draft.
   *
   * The forms fill themselves in an effect keyed on this. Without a counter,
   * pressing the button twice after editing a field by hand would be a no-op —
   * the draft object would be equal and the effect would not re-run.
   */
  appliedAt: number;
}

const AiDraftContext = createContext<AiDraftState>({ draft: null, appliedAt: 0 });

/** What a form reads. Null until someone presses the button. */
export function useAiDraft(): AiDraftState {
  return useContext(AiDraftContext);
}

const AiDraftSetterContext = createContext<(draft: PlantDraft | null) => void>(() => {});

export function AiAssistProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AiDraftState>({ draft: null, appliedAt: 0 });

  const apply = useCallback((draft: PlantDraft | null) => {
    setState((prev) => ({ draft, appliedAt: prev.appliedAt + 1 }));
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <AiDraftSetterContext.Provider value={apply}>
      <AiDraftContext.Provider value={value}>{children}</AiDraftContext.Provider>
    </AiDraftSetterContext.Provider>
  );
}

/**
 * Merge a drafted value over a typed one.
 *
 * Empty means the model had nothing to say, not that the field should be
 * cleared — a plant whose toxicity is genuinely unknown must not wipe the note
 * someone wrote from the supplier's sheet last month.
 */
export function preferDraft(drafted: string, current: string): string {
  return drafted.trim() === "" ? current : drafted;
}

export function AiAssistCard({
  productId,
  hasPhoto,
}: {
  productId: string;
  hasPhoto: boolean;
}) {
  const apply = useContext(AiDraftSetterContext);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlantDraft | null>(null);

  const run = () => {
    setError(null);
    start(async () => {
      const result = await draftPlantDetails(productId);
      if (result.ok) {
        setDraft(result.draft);
        apply(result.draft);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={run} disabled={pending} className="gap-2">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {pending
            ? "Reading the plant…"
            : draft
              ? "Draft it again"
              : hasPhoto
                ? "Read the photo and draft everything"
                : "Draft everything from the name"}
        </Button>

        {!hasPhoto ? (
          <p className="text-[12px] leading-relaxed text-text-tertiary">
            No photo yet, so it works from the name alone. Add one first for a better draft.
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-sunken px-4 py-3.5">
          <p className="text-[13px] leading-relaxed">
            Filled in below as <strong className="font-medium">{draft.identifiedAs || "an unnamed species"}</strong>.
            Nothing is saved yet — read each section and press its Save button.
          </p>

          {!draft.confident ? (
            <p className="flex gap-2 text-[12px] leading-relaxed text-warning-strong">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                It is <strong className="font-medium">not sure</strong> this is the right
                plant. Check the name and the care settings before saving anything.
              </span>
            </p>
          ) : null}

          {draft.notes ? (
            <p className="text-[12px] leading-relaxed text-text-secondary">{draft.notes}</p>
          ) : null}

          {/*
            Pet safety is the one field the draft cannot fill in the operator's
            favour, so it is the one worth saying out loud. Silence here would
            read as "the AI checked and it is fine", which is the exact belief
            this feature must never create.
          */}
          <p className="text-[12px] leading-relaxed text-text-tertiary">
            {draft.attributes.petSafe === false
              ? "It believes this plant is toxic to pets and has said so below. Confirm before saving."
              : "Pet safety is left at “Not verified”. The AI is never allowed to mark a plant safe — that stays your call."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
