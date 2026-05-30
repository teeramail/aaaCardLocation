"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { CardForm } from "@/components/card-form";
import type { CardRecord, PlaceRecord } from "@/components/dashboard-types";

const FORM_ID = "card-detail-edit-form";

export function CardDetailModal(props: {
  card: CardRecord | null;
  open: boolean;
  initialMode?: "view" | "edit";
  initialPlace?: PlaceRecord | null;
  onClose: () => void;
  onSaved: (card: CardRecord, message: string) => Promise<void> | void;
  onOpenPlace?: (place: PlaceRecord) => void;
}) {
  const { card, open, initialMode, initialPlace, onClose, onOpenPlace, onSaved } = props;
  const [mode, setMode] = useState<"view" | "edit">(card ? (initialMode ?? "view") : "edit");
  const [isFormBusy, setIsFormBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(card ? (initialMode ?? "view") : "edit");
    }
  }, [card, initialMode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const linkedPlace = card?.place ?? null;
  const title = card?.title ?? "Create card";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-none border border-white/10 bg-slate-950 text-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {linkedPlace ? "Card linked to one location" : "Card without a linked location"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {card && mode === "view" ? (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
              >
                Edit
              </button>
            ) : null}
            {mode === "edit" ? (
              <>
                {card ? (
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    disabled={isFormBusy}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="submit"
                  form={FORM_ID}
                  disabled={isFormBusy}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isFormBusy ? "Saving..." : card ? "Save" : "Create"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "edit" ? (
            <div className="p-5">
              <CardForm
                editingCard={card}
                initialPlace={initialPlace ?? null}
                onCancelEdit={() => {
                  if (card) {
                    setMode("view");
                    return;
                  }
                  onClose();
                }}
                onSaved={async (savedCard, message) => {
                  await onSaved(savedCard, message);
                  if (card) {
                    setMode("view");
                  }
                  onClose();
                }}
                formId={FORM_ID}
                hideSubmit
                onBusyChange={setIsFormBusy}
              />
            </div>
          ) : card ? (
            <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {linkedPlace?.imageUrl ? (
                <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-slate-900 md:h-full md:min-h-[320px]">
                  <Image
                    src={linkedPlace.imageUrl}
                    alt={linkedPlace.imageAlt ?? linkedPlace.name}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500 md:h-full md:min-h-[320px]">
                  {linkedPlace ? "Linked place has no image" : "No linked location"}
                </div>
              )}

              <div className="space-y-4 text-sm">
                {linkedPlace ? (
                  <Section label="Linked location">
                    <div className="space-y-2">
                      <p className="font-medium text-white">{linkedPlace.name}</p>
                      <p className="text-slate-300">
                        {[linkedPlace.city, linkedPlace.country].filter(Boolean).join(", ") || "Location details available"}
                      </p>
                      <p className="font-mono text-xs text-slate-400">
                        {linkedPlace.latitude.toFixed(6)}, {linkedPlace.longitude.toFixed(6)}
                      </p>
                      {onOpenPlace ? (
                        <button
                          type="button"
                          onClick={() => onOpenPlace?.(linkedPlace)}
                          className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                        >
                          Open location
                        </button>
                      ) : null}
                    </div>
                  </Section>
                ) : null}

                {card.description ? (
                  <Section label="Description">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-200">{card.description}</div>
                  </Section>
                ) : null}

                {card.notes ? (
                  <Section label="Notes">
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-200">{card.notes}</div>
                  </Section>
                ) : null}

                {card.linkUrl ? (
                  <Section label="Link">
                    <a
                      href={card.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sky-300 hover:underline"
                    >
                      {card.linkUrl}
                    </a>
                  </Section>
                ) : null}

                <Section label="Created">
                  <span className="text-xs text-slate-400">
                    {new Date(card.createdAt).toLocaleString()}
                  </span>
                </Section>

                {card.updatedAt.toString() !== card.createdAt.toString() ? (
                  <Section label="Updated">
                    <span className="text-xs text-slate-400">
                      {new Date(card.updatedAt).toLocaleString()}
                    </span>
                  </Section>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{props.label}</div>
      <div className="mt-1 text-slate-100">{props.children}</div>
    </div>
  );
}
