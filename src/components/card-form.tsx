"use client";

import { useEffect, useMemo, useState } from "react";

import type { CardRecord, PlaceRecord } from "@/components/dashboard-types";
import { trpc } from "@/trpc/react";

const defaultValues = {
  title: "",
  description: "",
  notes: "",
  linkUrl: ""
} as const;

type FormValues = {
  title: string;
  description: string;
  notes: string;
  linkUrl: string;
  placeIds: string[];
  primaryPlaceId: string | null;
};

function createValuesFromCard(card: CardRecord | null, initialPlace: PlaceRecord | null): FormValues {
  if (!card) {
    return {
      ...defaultValues,
      title: initialPlace?.name ?? defaultValues.title,
      placeIds: initialPlace ? [initialPlace.id] : [],
      primaryPlaceId: initialPlace?.id ?? null
    };
  }

  return {
    title: card.title,
    description: card.description ?? "",
    notes: card.notes ?? "",
    linkUrl: card.linkUrl ?? "",
    placeIds: card.places.map((place) => place.id),
    primaryPlaceId: card.primaryPlaceId ?? card.places[0]?.id ?? null
  };
}

export function CardForm(props: {
  editingCard: CardRecord | null;
  initialPlace?: PlaceRecord | null;
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

  const placesById = useMemo(() => {
    const map = new Map<string, PlaceRecord>();
    for (const place of placeOptions) {
      map.set(place.id, place);
    }
    for (const place of editingCard?.places ?? []) {
      if (!map.has(place.id)) {
        map.set(place.id, place);
      }
    }
    if (initialPlace && !map.has(initialPlace.id)) {
      map.set(initialPlace.id, initialPlace);
    }
    return map;
  }, [editingCard?.places, initialPlace, placeOptions]);

  const selectedPlaces = useMemo(
    () => values.placeIds.flatMap((id) => (placesById.has(id) ? [placesById.get(id)!] : [])),
    [placesById, values.placeIds]
  );

  const togglePlace = (placeId: string) => {
    setValues((current) => {
      const isSelected = current.placeIds.includes(placeId);
      const placeIds = isSelected
        ? current.placeIds.filter((id) => id !== placeId)
        : [...current.placeIds, placeId];
      let primaryPlaceId = current.primaryPlaceId;
      if (isSelected && primaryPlaceId === placeId) {
        primaryPlaceId = placeIds[0] ?? null;
      }
      if (!isSelected && !primaryPlaceId) {
        primaryPlaceId = placeId;
      }
      return { ...current, placeIds, primaryPlaceId };
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      {!hideSubmit ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingCard ? "Edit card" : "Create card"}
            </h2>
            <p className="text-sm text-slate-400">
              Link this card to one or more locations, or leave it unlinked for now. Locations can be shared across multiple cards.
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
          const primaryPlaceId =
            values.primaryPlaceId && values.placeIds.includes(values.primaryPlaceId)
              ? values.primaryPlaceId
              : values.placeIds[0] ?? null;
          upsertMutation.mutate({
            id: editingCard?.id,
            title: values.title,
            description: values.description || null,
            notes: values.notes || null,
            linkUrl: values.linkUrl || null,
            placeIds: values.placeIds,
            primaryPlaceId
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

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Linked locations</span>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-2">
            {placeOptionsQuery.isLoading ? (
              <p className="px-2 py-3 text-xs text-slate-400">Loading available locations...</p>
            ) : placeOptions.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-400">
                No locations yet. You can still create a card without one.
              </p>
            ) : (
              placeOptions.map((place) => {
                const checked = values.placeIds.includes(place.id);
                const isPrimary = values.primaryPlaceId === place.id;
                return (
                  <div
                    key={place.id}
                    className={`flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition ${checked ? "bg-sky-500/10" : "hover:bg-white/5"}`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlace(place.id)}
                        className="h-4 w-4 shrink-0 rounded border-white/20 bg-slate-800 text-sky-500 focus:ring-sky-400"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">{place.name}</span>
                        {place.city || place.country ? (
                          <span className="block truncate text-xs text-slate-400">
                            {[place.city, place.country].filter(Boolean).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {checked ? (
                      <button
                        type="button"
                        onClick={() => setValues((current) => ({ ...current, primaryPlaceId: place.id }))}
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${isPrimary ? "bg-sky-400/20 text-sky-200" : "border border-white/10 text-slate-300 hover:bg-white/5"}`}
                      >
                        {isPrimary ? "Primary" : "Set primary"}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <p className="text-xs text-slate-400">
            {selectedPlaces.length === 0
              ? "This card will not appear on the map until you link a location."
              : `${selectedPlaces.length} location${selectedPlaces.length === 1 ? "" : "s"} linked. The primary location is used for the map focus and preview image.`}
          </p>
        </div>

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
