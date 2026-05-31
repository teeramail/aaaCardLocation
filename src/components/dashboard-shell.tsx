"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "next-auth";

import { CardDetailModal } from "@/components/card-detail-modal";
import { CategoryManager } from "@/components/category-manager";
import type { CardRecord, PlaceRecord } from "@/components/dashboard-types";
import { PlaceDetailModal } from "@/components/place-detail-modal";
import { PlacesMap } from "@/components/places-map";
import { PlacesTable } from "@/components/places-table";
import { SelectionMetrics } from "@/components/selection-metrics";
import { SignOutButton } from "@/components/sign-out-button";
import { parseGpxKml } from "@/lib/gpx-kml-parser";
import { calculatePathDistance, formatDistanceLabel } from "@/lib/utils";
import { trpc } from "@/trpc/react";

type CardModalState = {
  card: CardRecord | null;
  mode: "view" | "edit";
  initialPlace?: PlaceRecord | null;
};

export function DashboardShell(props: { session: Session | null }) {
  const isSignedIn = Boolean(props.session);
  const utils = trpc.useUtils();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardModal, setCardModal] = useState<CardModalState | null>(null);
  const [modalPlace, setModalPlace] = useState<{ place: PlaceRecord; mode: "view" | "edit" } | null>(null);
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placesQuery = trpc.place.list.useQuery();
  const cardsQuery = trpc.card.list.useQuery();
  const tracksQuery = trpc.track.list.useQuery(undefined, { enabled: isSignedIn });

  const invalidateCardData = async () => {
    await Promise.all([utils.card.list.invalidate(), utils.card.placeOptions.invalidate()]);
  };

  const invalidatePlaceAndCardData = async () => {
    await Promise.all([
      utils.place.list.invalidate(),
      utils.card.list.invalidate(),
      utils.card.placeOptions.invalidate()
    ]);
  };

  const deletePlaceMutation = trpc.place.delete.useMutation({
    onSuccess: async () => {
      setStatusMessage("Place deleted.");
      setModalPlace(null);
      await invalidatePlaceAndCardData();
    }
  });

  const deleteCardMutation = trpc.card.delete.useMutation({
    onSuccess: async () => {
      setStatusMessage("Card deleted.");
      setCardModal(null);
      await invalidateCardData();
    }
  });

  const createTrackMutation = trpc.track.create.useMutation({
    onSuccess: async () => {
      setStatusMessage("Track uploaded successfully.");
      await utils.track.list.invalidate();
    },
    onError: (error) => {
      setStatusMessage(`Failed to upload track: ${error.message}`);
    }
  });

  const deleteTrackMutation = trpc.track.delete.useMutation({
    onSuccess: async () => {
      setStatusMessage("Track deleted.");
      await utils.track.list.invalidate();
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const content = loadEvent.target?.result as string;
      const points = parseGpxKml(content);
      if (points.length < 2) {
        setStatusMessage("No valid track points found in file.");
        return;
      }

      createTrackMutation.mutate({
        name: file.name,
        points
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const places = useMemo(() => placesQuery.data ?? [], [placesQuery.data]);
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const tracks = useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);

  useEffect(() => {
    setSelectedCardIds((current) => {
      const next = current.filter((id) => cards.some((card) => card.id === id));
      return next.length === current.length ? current : next;
    });
  }, [cards]);

  useEffect(() => {
    if (!cardModal?.card) {
      return;
    }

    const refreshedCard = cards.find((card) => card.id === cardModal.card?.id) ?? null;
    if (!refreshedCard) {
      setCardModal(null);
      return;
    }

    if (refreshedCard !== cardModal.card) {
      setCardModal({ ...cardModal, card: refreshedCard });
    }
  }, [cardModal, cards]);

  useEffect(() => {
    if (!modalPlace) {
      return;
    }

    const refreshedPlace = places.find((place) => place.id === modalPlace.place.id) ?? null;
    if (!refreshedPlace) {
      setModalPlace(null);
      return;
    }

    if (refreshedPlace !== modalPlace.place) {
      setModalPlace({ ...modalPlace, place: refreshedPlace });
    }
  }, [modalPlace, places]);

  const placeIdToCardIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const card of cards) {
      for (const place of card.places) {
        const list = map.get(place.id) ?? [];
        list.push(card.id);
        map.set(place.id, list);
      }
    }
    return map;
  }, [cards]);

  const linkedPlaces = useMemo(() => {
    const map = new Map<string, PlaceRecord>();
    for (const card of cards) {
      for (const place of card.places) {
        if (!map.has(place.id)) {
          map.set(place.id, place);
        }
      }
    }
    return Array.from(map.values());
  }, [cards]);

  const linkedPlaceIdSet = useMemo(() => new Set(linkedPlaces.map((place) => place.id)), [linkedPlaces]);

  const unlinkedPlaces = useMemo(
    () => places.filter((place) => !linkedPlaceIdSet.has(place.id)),
    [linkedPlaceIdSet, places]
  );

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedCardIds.includes(card.id)),
    [cards, selectedCardIds]
  );

  const selectedLinkedPlaces = useMemo(() => {
    const map = new Map<string, PlaceRecord>();
    for (const card of selectedCards) {
      for (const place of card.places) {
        if (!map.has(place.id)) {
          map.set(place.id, place);
        }
      }
    }
    return Array.from(map.values());
  }, [selectedCards]);

  const visiblePlaces = selectedCardIds.length > 0 ? selectedLinkedPlaces : linkedPlaces;
  const selectedPlaceIds = selectedCardIds.length > 0 ? selectedLinkedPlaces.map((place) => place.id) : [];

  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]
    );
  };

  const togglePlaceSelection = (placeId: string) => {
    const linkedCardIds = placeIdToCardIds.get(placeId);
    if (!linkedCardIds || linkedCardIds.length === 0) {
      return;
    }

    setSelectedCardIds((current) => {
      const allSelected = linkedCardIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !linkedCardIds.includes(id));
      }
      const next = new Set(current);
      for (const id of linkedCardIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  };

  const selectedSummary = useMemo(() => {
    if (cards.length === 0) {
      return "Create your first card to start linking locations.";
    }

    if (selectedCards.length === 0) {
      return `${cards.length} card${cards.length === 1 ? "" : "s"} available · ${linkedPlaces.length} linked location${linkedPlaces.length === 1 ? "" : "s"}.`;
    }

    if (selectedCards.length === 1) {
      const only = selectedCards[0]!;
      return only.places.length > 0
        ? `Showing ${only.title} and its ${only.places.length} linked location${only.places.length === 1 ? "" : "s"}.`
        : `Showing ${only.title}. This card has no linked location yet.`;
    }

    return `Showing ${selectedCards.length} selected cards.`;
  }, [cards.length, linkedPlaces.length, selectedCards]);

  const linkedCardsCount = cards.filter((card) => card.places.length > 0).length;
  const cardsWithoutLocationCount = cards.length - linkedCardsCount;

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <header className="order-2 rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur xl:order-none xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-sky-300">MyMap Dashboard</p>
              <h1 className="text-3xl font-semibold text-white">
                {props.session?.user?.name ? `Welcome, ${props.session.user.name}` : "Welcome to MyMap"}
              </h1>
              <p className="max-w-3xl text-sm text-slate-300">
                Create separate cards for each location, keep optional cards without locations, and let the map follow the linked cards you select.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isSignedIn ? (
                <SignOutButton />
              ) : (
                <Link
                  href="/login"
                  className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                >
                  Sign in to edit
                </Link>
              )}
            </div>
          </div>
        </header>

        <aside className="order-3 space-y-6 xl:order-none xl:col-start-1 xl:row-start-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Location cards</h2>
                <p className="text-sm text-slate-400">{selectedSummary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isSignedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setAddChooserOpen(true)}
                      className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-sky-400"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5"
                    >
                      Categories
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCardIds([]);
                    setStatusMessage("Selection cleared.");
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Card coverage</p>
                <p className="mt-1 text-xl font-semibold text-white">{cards.length}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {linkedCardsCount} linked · {cardsWithoutLocationCount} without location
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Locations left to link</p>
                <p className="mt-1 text-xl font-semibold text-white">{unlinkedPlaces.length}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {places.length} total saved location{places.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {isSignedIn ? (
              <div className="mb-4">
                <input
                  type="file"
                  accept=".gpx,.kml"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={createTrackMutation.isPending}
                  className="w-full rounded-xl border border-dashed border-sky-400/50 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
                >
                  {createTrackMutation.isPending ? "Uploading..." : "Import Road (GPX/KML)"}
                </button>
              </div>
            ) : null}

            {tracks.length > 0 ? (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">My Recorded Roads</h3>
                {tracks.map((track) => (
                  <div key={track.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3">
                    <div>
                      <p className="text-sm text-white">{track.name}</p>
                      <p className="text-xs text-slate-400">
                        {track.points.length} points · {formatDistanceLabel(calculatePathDistance(track.points))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTrackMutation.mutate({ id: track.id })}
                      disabled={deleteTrackMutation.isPending}
                      className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              {cards.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const linkedPlaces = card.places;
                const linkedPlace = card.primaryPlace ?? linkedPlaces[0] ?? null;

                return (
                  <div
                    key={card.id}
                    id={`location-card-${card.id}`}
                    className={isSelected ? "overflow-hidden rounded-2xl border border-sky-400/50 bg-sky-500/10" : "overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60"}
                  >
                    {linkedPlace?.imageUrl ? (
                      <div className="relative h-36 w-full">
                        <Image
                          src={linkedPlace.imageUrl}
                          alt={linkedPlace.imageAlt ?? linkedPlace.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}

                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCardSelection(card.id)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-400"
                        />

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{card.title}</p>
                              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                                {linkedPlaces.length === 0
                                  ? "No linked location"
                                  : linkedPlaces.length === 1 && linkedPlace
                                    ? [linkedPlace.city, linkedPlace.country].filter(Boolean).join(" · ") || linkedPlace.name
                                    : `${linkedPlaces.length} linked locations`}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={linkedPlaces.length > 0 ? "rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200" : "rounded-full bg-slate-700/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200"}>
                                {linkedPlaces.length === 0
                                  ? "No location"
                                  : linkedPlaces.length === 1
                                    ? "Linked"
                                    : `${linkedPlaces.length} linked`}
                              </span>
                              {linkedPlace?.isMain ? (
                                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                  Main
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <p className="line-clamp-3 text-sm text-slate-300">
                            {card.description ?? card.notes ?? "No description or notes yet."}
                          </p>

                          {linkedPlace ? (
                            <p className="text-xs text-slate-400">
                              {linkedPlace.latitude.toFixed(5)}, {linkedPlace.longitude.toFixed(5)}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Select this card to focus your workflow, then link a location when ready.
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setCardModal({ card, mode: "view" })}
                              className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                            >
                              ⛶ Open card
                            </button>
                            {linkedPlace ? (
                              <button
                                type="button"
                                onClick={() => setModalPlace({ place: linkedPlace, mode: "view" })}
                                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/5"
                              >
                                Open location
                              </button>
                            ) : null}
                            {isSignedIn ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setCardModal({ card, mode: "edit" })}
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/5"
                                >
                                  Edit card
                                </button>
                                {linkedPlace ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setModalPlace({ place: linkedPlace, mode: "edit" })}
                                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/5"
                                    >
                                      Edit location
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deletePlaceMutation.mutate({ id: linkedPlace.id })}
                                      disabled={deletePlaceMutation.isPending}
                                      className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      Delete location
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => deleteCardMutation.mutate({ id: card.id })}
                                  disabled={deleteCardMutation.isPending}
                                  className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!cardsQuery.isLoading && cards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                  No cards yet. Create a card first, then optionally link it to a saved location.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Locations without cards</h2>
                <p className="text-sm text-slate-400">
                  These places are saved, but not yet linked to any card.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {unlinkedPlaces.length} open
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {unlinkedPlaces.map((place) => (
                <div key={place.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{place.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {[place.city, place.country].filter(Boolean).join(" · ") || "Location details available"}
                      </p>
                    </div>
                    {place.isMain ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        Main
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModalPlace({ place, mode: "view" })}
                      className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                    >
                      Open location
                    </button>
                    {isSignedIn ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setCardModal({ card: null, mode: "edit", initialPlace: place })}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/5"
                        >
                          Create card
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePlaceMutation.mutate({ id: place.id })}
                          disabled={deletePlaceMutation.isPending}
                          className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Delete location
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}

              {unlinkedPlaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                  Every saved location is already linked to a card.
                </div>
              ) : null}
            </div>
          </div>

          {!isSignedIn ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300 shadow-xl shadow-sky-950/20 backdrop-blur">
              <p className="font-medium text-white">Want to add or edit locations?</p>
              <p className="mt-2 text-slate-400">
                Sign in to manage cards and locations. Viewing is free for everyone.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
              >
                Sign in
              </Link>
            </div>
          ) : null}
        </aside>

        <div className="order-1 space-y-6 xl:order-none xl:col-start-2 xl:row-start-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-sky-950/20 backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
              <div>
                <h2 className="text-lg font-semibold text-white">Interactive map</h2>
                <p className="text-sm text-slate-400">
                  {selectedCardIds.length > 0
                    ? `The map is fitting ${selectedLinkedPlaces.length} linked location${selectedLinkedPlaces.length === 1 ? "" : "s"} from ${selectedCards.length} selected card${selectedCards.length === 1 ? "" : "s"}.`
                    : "Select cards with linked locations to filter the map and auto-fit the view."}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {visiblePlaces.length} visible · {linkedPlaces.length} linked · {places.length} total locations
              </div>
            </div>

            <PlacesMap
              places={visiblePlaces}
              tracks={tracks}
              selectedIds={selectedPlaceIds}
              onToggleSelect={togglePlaceSelection}
              onEditPlace={() => undefined}
              onPlaceSaved={async () => {
                setStatusMessage("Place updated.");
                await invalidatePlaceAndCardData();
              }}
            />
          </div>

          <SelectionMetrics places={visiblePlaces} />

          <PlacesTable
            places={visiblePlaces}
            selectedIds={selectedPlaceIds}
            onToggleSelect={togglePlaceSelection}
            onExpandPlace={(place) => setModalPlace({ place, mode: "view" })}
          />

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Selection tips</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm font-medium text-white">Select cards, not just places</p>
                <p className="mt-2 text-sm text-slate-300">
                  Cards are now the primary unit. Linked cards drive what the map and table show.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm font-medium text-white">Keep optional blank cards</p>
                <p className="mt-2 text-sm text-slate-300">
                  A card can exist before you know which location it belongs to. Link it later when ready.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm font-medium text-white">Track locations still work</p>
                <p className="mt-2 text-sm text-slate-300">
                  Your saved roads, place metrics, and modal location editor still work on the linked locations.
                </p>
              </div>
            </div>

            {statusMessage ? (
              <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {statusMessage}
              </p>
            ) : null}

            {selectedLinkedPlaces.length >= 2 ? (
              <p className="mt-4 text-sm text-slate-400">
                Quick path summary: {selectedLinkedPlaces.map((place) => place.name).join(" → ")}.
                Use the metrics panel for exact values like {formatDistanceLabel(1500)} style labels.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {addChooserOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setAddChooserOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">What do you want to add?</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pick one to get started. You can always link a card to a location later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddChooserOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setAddChooserOpen(false);
                  setAddPlaceOpen(true);
                }}
                className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-left transition hover:bg-sky-500/20"
              >
                <p className="text-base font-semibold text-white">📍 Add location</p>
                <p className="mt-1 text-sm text-slate-300">
                  Save a place on the map with coordinates, image, and details.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAddChooserOpen(false);
                  setCardModal({ card: null, mode: "edit", initialPlace: null });
                }}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left transition hover:bg-white/5"
              >
                <p className="text-base font-semibold text-white">🗂️ Add card</p>
                <p className="mt-1 text-sm text-slate-300">
                  Create a card now and optionally link it to a saved location.
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PlaceDetailModal
        place={null}
        open={addPlaceOpen}
        initialMode="edit"
        onClose={() => setAddPlaceOpen(false)}
        onSaved={async (message) => {
          setStatusMessage(message);
          await invalidatePlaceAndCardData();
        }}
      />

      <CategoryManager open={showCategoryManager} onClose={() => setShowCategoryManager(false)} />

      <CardDetailModal
        card={cardModal?.card ?? null}
        open={cardModal !== null}
        initialMode={cardModal?.mode ?? "edit"}
        initialPlace={cardModal?.initialPlace ?? null}
        onClose={() => setCardModal(null)}
        onSaved={async (_card, message) => {
          setStatusMessage(message);
          await invalidateCardData();
        }}
        onOpenPlace={(place) => {
          setCardModal(null);
          setModalPlace({ place, mode: "view" });
        }}
      />

      <PlaceDetailModal
        place={modalPlace?.place ?? null}
        open={modalPlace !== null}
        initialMode={modalPlace?.mode ?? "view"}
        onClose={() => setModalPlace(null)}
        onSaved={async (message) => {
          setStatusMessage(message);
          await invalidatePlaceAndCardData();
        }}
      />
    </main>
  );
}
