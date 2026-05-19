"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { PlaceRecord } from "@/components/dashboard-shell";
import { PlaceForm } from "@/components/place-form";

export function PlaceDetailModal(props: {
  place: PlaceRecord | null;
  open: boolean;
  initialMode?: "view" | "edit";
  onClose: () => void;
  onSaved?: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "edit">(props.initialMode ?? "view");

  useEffect(() => {
    if (props.open) {
      setMode(props.initialMode ?? "view");
    }
  }, [props.open, props.initialMode, props.place?.id]);

  // Lock body scroll while open
  useEffect(() => {
    if (!props.open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [props.open]);

  // Close on Escape
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!props.open || !props.place) return null;

  const place = props.place;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-none border border-white/10 bg-slate-950 text-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{place.name}</h2>
            {place.isMain ? (
              <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Main
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "view" && props.onSaved ? (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/5"
              aria-label="Close"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {mode === "view" ? (
            <ViewMode place={place} />
          ) : (
            <div className="p-5">
              <PlaceForm
                editingPlace={place}
                onCancelEdit={() => setMode("view")}
                onSaved={async (message) => {
                  await props.onSaved?.(message);
                  props.onClose();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewMode({ place }: { place: PlaceRecord }) {
  return (
    <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Image */}
      {place.imageUrl ? (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-slate-900 md:h-full md:min-h-[320px]">
          <Image
            src={place.imageUrl}
            alt={place.imageAlt ?? place.name}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500 md:h-full md:min-h-[320px]">
          No image
        </div>
      )}

      {/* Details */}
      <div className="space-y-3 text-sm">
        <Field label="Category">
          <span className="capitalize">{place.category.replace(/_/g, " ")}</span>
        </Field>

        {place.city || place.country ? (
          <Field label="Location">{[place.city, place.country].filter(Boolean).join(", ")}</Field>
        ) : null}

        <Field label="Coordinates">
          <span className="font-mono text-xs">
            {place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}
          </span>
        </Field>

        {place.dueDate ? (
          <Field label="Due date">
            <span>{new Date(place.dueDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          </Field>
        ) : null}

        {place.budget !== null && place.budget !== undefined ? (
          <Field label="Budget">
            <span>{place.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </Field>
        ) : null}

        {place.linkUrl ? (
          <Field label="Link">
            <a
              href={place.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sky-300 hover:underline"
            >
              {place.linkUrl}
            </a>
          </Field>
        ) : null}

        {place.description ? (
          <Field label="Description">
            <div className="whitespace-pre-wrap leading-relaxed text-slate-200">
              {place.description}
            </div>
          </Field>
        ) : null}

        <Field label="Created">
          <span className="text-xs text-slate-400">
            {new Date(place.createdAt).toLocaleString()}
          </span>
        </Field>

        {place.updatedAt && place.updatedAt.toString() !== place.createdAt.toString() ? (
          <Field label="Updated">
            <span className="text-xs text-slate-400">
              {new Date(place.updatedAt).toLocaleString()}
            </span>
          </Field>
        ) : null}
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{props.label}</div>
      <div className="mt-1 text-slate-100">{props.children}</div>
    </div>
  );
}
