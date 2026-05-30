"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { CardRecord } from "@/components/dashboard-types";
import { trpc } from "@/trpc/react";

const defaultValues = {
  title: "",
  description: "",
  notes: "",
  linkUrl: "",
  placeId: ""
} as const;

type FormValues = {
  title: string;
  description: string;
  notes: string;
  linkUrl: string;
  placeId: string;
};

function createValuesFromCard(card: CardRecord | null, initialPlace: CardRecord["place"] | null): FormValues {
  if (!card) {
    return {
      ...defaultValues,
      title: initialPlace?.name ?? defaultValues.title,
      placeId: initialPlace?.id ?? defaultValues.placeId
    };
  }

  return {
    title: card.title,
    description: card.description ?? "",
    notes: card.notes ?? "",
    linkUrl: card.linkUrl ?? "",
    placeId: card.placeId ?? ""
  };
}

export function CardForm(props: {
  editingCard: CardRecord | null;
  initialPlace?: CardRecord["place"] | null;
  onCancelEdit: () => void;
  onSaved: (card: CardRecord, message: string) => Promise<void> | void;
  formId?: string;
  hideSubmit?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { editingCard, initialPlace, onBusyChange, onCancelEdit, onSaved, formId, hideSubmit } = props;
  const [values, setValues] = useState<FormValues>(() => createValuesFromCard(editingCard, initialPlace ?? null));
  const [formError, setFormError] = useState<string | null>(null);

  const placeOptionsQuery = trpc.card.placeOptions.useQuery(
    editingCard ? { cardId: editingCard.id } : undefined
  );

  const upsertMutation = trpc.card.upsert.useMutation({
    onSuccess: async (savedCard) => {
      setFormError(null);
      setValues(createValuesFromCard(null, initialPlace ?? null));
      await onSaved(savedCard, editingCard ? "Card updated." : "Card created.");
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  useEffect(() => {
    setValues(createValuesFromCard(editingCard, initialPlace ?? null));
    setFormError(null);
  }, [editingCard, initialPlace]);

  const isBusy = upsertMutation.isPending;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const placeOptions = useMemo(() => placeOptionsQuery.data ?? [], [placeOptionsQuery.data]);

  const selectedPlace = useMemo(() => {
    if (!values.placeId) {
      return null;
    }

    return placeOptions.find((place) => place.id === values.placeId) ?? editingCard?.place ?? initialPlace ?? null;
  }, [editingCard?.place, initialPlace, placeOptions, values.placeId]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      {!hideSubmit ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingCard ? "Edit card" : "Create card"}
            </h2>
            <p className="text-sm text-slate-400">
              Keep one card per location, or create a card without linking any location yet.
            </p>
          </div>
          {editingCard ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          upsertMutation.mutate({
            id: editingCard?.id,
            title: values.title,
            description: values.description || null,
            notes: values.notes || null,
            linkUrl: values.linkUrl || null,
            placeId: values.placeId || null
          });
        }}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Card title</span>
          <input
            value={values.title}
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Linked location</span>
          <select
            value={values.placeId}
            onChange={(event) => setValues((current) => ({ ...current, placeId: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          >
            <option value="">No linked location</option>
            {placeOptions.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
                {place.city || place.country ? ` · ${[place.city, place.country].filter(Boolean).join(", ")}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            {placeOptionsQuery.isLoading
              ? "Loading available locations..."
              : placeOptions.length > 0
                ? "A location can only be linked to one card at a time."
                : "No unlinked locations are available right now. You can still create a card without one."}
          </p>
        </label>

        {selectedPlace ? (
          <div className="overflow-hidden rounded-2xl border border-sky-400/20 bg-sky-500/10">
            {selectedPlace.imageUrl ? (
              <div className="relative h-40 w-full">
                <Image
                  src={selectedPlace.imageUrl}
                  alt={selectedPlace.imageAlt ?? selectedPlace.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{selectedPlace.name}</p>
                <span className="rounded-full bg-sky-400/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                  Linked location
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                {[selectedPlace.city, selectedPlace.country].filter(Boolean).join(" · ") || "Location details available"}
              </p>
              <p className="text-xs text-slate-400">
                {selectedPlace.latitude.toFixed(5)}, {selectedPlace.longitude.toFixed(5)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
            This card will not appear on the map until you link a location.
          </div>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea
            value={values.description}
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Notes</span>
          <textarea
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Link URL</span>
          <input
            type="url"
            value={values.linkUrl}
            onChange={(event) => setValues((current) => ({ ...current, linkUrl: event.target.value }))}
            placeholder="https://example.com"
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        {formError ? (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        {!hideSubmit ? (
          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy
              ? editingCard
                ? "Saving..."
                : "Creating..."
              : editingCard
                ? "Save card"
                : "Create card"}
          </button>
        ) : null}
      </form>
    </div>
  );
}
