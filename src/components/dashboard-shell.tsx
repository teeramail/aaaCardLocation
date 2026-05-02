"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "next-auth";

import { PlaceForm } from "@/components/place-form";
import { PlacesMap } from "@/components/places-map";
import { SelectionMetrics } from "@/components/selection-metrics";
import { SignOutButton } from "@/components/sign-out-button";
import { formatDistanceLabel } from "@/lib/utils";
import { trpc } from "@/trpc/react";

export type PlaceRecord = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string | null;
  category: "primary_school" | "secondary_school" | "university" | "office" | "home" | "other";
  isMain: boolean;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  imageAlt: string | null;
};

export function DashboardShell(props: { session: Session | null }) {
  const isSignedIn = Boolean(props.session);
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingPlace, setEditingPlace] = useState<PlaceRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const placesQuery = trpc.place.list.useQuery();

  const deleteMutation = trpc.place.delete.useMutation({
    onSuccess: async () => {
      setStatusMessage("Place deleted.");
      setEditingPlace(null);
      await utils.place.list.invalidate();
    }
  });

  const places = useMemo(() => placesQuery.data ?? [], [placesQuery.data]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => places.some((place) => place.id === id));
      return next.length === current.length ? current : next;
    });
  }, [places]);

  useEffect(() => {
    if (!editingPlace) {
      return;
    }

    const refreshedPlace = places.find((place) => place.id === editingPlace.id) ?? null;
    if (refreshedPlace !== editingPlace) {
      setEditingPlace(refreshedPlace);
    }
  }, [editingPlace, places]);

  useEffect(() => {
    if (!editingPlace) {
      return;
    }

    const card = document.getElementById(`place-card-${editingPlace.id}`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [editingPlace]);

  const selectedPlaces = useMemo(
    () => places.filter((place) => selectedIds.includes(place.id)),
    [places, selectedIds]
  );
  const visiblePlaces = selectedIds.length > 0 ? selectedPlaces : places;

  const selectedSummary = useMemo(() => {
    if (selectedPlaces.length === 0) {
      return "Showing all saved places.";
    }

    if (selectedPlaces.length === 1) {
      return `Showing ${selectedPlaces[0]?.name}.`;
    }

    return `Showing ${selectedPlaces.length} selected places.`;
  }, [selectedPlaces]);

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
                Save places anywhere, select only the ones you want to compare, and let the map fit those selected markers automatically.
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
                  <h2 className="text-lg font-semibold text-white">Saved places</h2>
                  <p className="text-sm text-slate-400">{selectedSummary}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([]);
                    setStatusMessage("Selection cleared.");
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5"
                >
                  Clear selection
                </button>
              </div>

              <div className="space-y-3">
                {places.map((place) => {
                  const isSelected = selectedIds.includes(place.id);
                  const isEditing = editingPlace?.id === place.id;

                  return (
                    <div
                      key={place.id}
                      id={`place-card-${place.id}`}
                      className={isSelected ? "rounded-2xl border border-sky-400/50 bg-sky-500/10 p-4" : "rounded-2xl border border-white/10 bg-slate-900/60 p-4"}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => {
                            setSelectedIds((current) => {
                              if (event.target.checked) {
                                return [...current, place.id];
                              }

                              return current.filter((id) => id !== place.id);
                            });
                          }}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-400"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">{place.name}</p>
                              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                                {place.city ?? "Unknown city"} · {place.country ?? "Unknown country"}
                              </p>
                            </div>
                            {place.isMain ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                Main
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                            {place.description ?? "No description yet."}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                          </p>

                          {isSignedIn ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingPlace(isEditing ? null : place)}
                                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/5"
                              >
                                {isEditing ? "Close editor" : "Edit"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate({ id: place.id })}
                                disabled={deleteMutation.isPending}
                                className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}

                          {isSignedIn && isEditing ? (
                            <div className="mt-4">
                              <PlaceForm
                                editingPlace={place}
                                onCancelEdit={() => setEditingPlace(null)}
                                onSaved={async (message) => {
                                  setStatusMessage(message);
                                  setEditingPlace(null);
                                  await utils.place.list.invalidate();
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!placesQuery.isLoading && places.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                    No places saved yet. Add your first school or seed sample places.
                  </div>
                ) : null}
              </div>
            </div>

            {isSignedIn ? (
              <PlaceForm
                editingPlace={null}
                onCancelEdit={() => undefined}
                onSaved={async (message) => {
                  setStatusMessage(message);
                  await utils.place.list.invalidate();
                }}
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300 shadow-xl shadow-sky-950/20 backdrop-blur">
                <p className="font-medium text-white">Want to add or edit places?</p>
                <p className="mt-2 text-slate-400">
                  Sign in to manage the map. Viewing is free for everyone.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-block rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                >
                  Sign in
                </Link>
              </div>
            )}
        </aside>

        <div className="order-1 space-y-6 xl:order-none xl:col-start-2 xl:row-start-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-sky-950/20 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
                <div>
                  <h2 className="text-lg font-semibold text-white">Interactive map</h2>
                  <p className="text-sm text-slate-400">
                    {selectedIds.length > 0
                      ? `The map is fitting ${selectedIds.length} selected place${selectedIds.length === 1 ? "" : "s"}.`
                      : "Select places to filter the map and auto-fit the view."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  {visiblePlaces.length} visible · {places.length} total
                </div>
              </div>

              <PlacesMap
                places={visiblePlaces}
                selectedIds={selectedIds}
                onToggleSelect={(placeId) => {
                  setSelectedIds((current) =>
                    current.includes(placeId)
                      ? current.filter((id) => id !== placeId)
                      : [...current, placeId]
                  );
                }}
                onEditPlace={(place) => {
                  setEditingPlace(place);
                }}
              />
            </div>

            <SelectionMetrics places={visiblePlaces} />

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
              <h2 className="text-lg font-semibold text-white">Selection tips</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-sm font-medium text-white">Show only selected places</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Choose any 3 places and the map will show only those 3 markers.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-sm font-medium text-white">Fit across regions</p>
                  <p className="mt-2 text-sm text-slate-300">
                    You can mix Bangkok, Chiang Mai, Taipei, or any other city and the viewport will fit them together.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-sm font-medium text-white">Measure straight-line distance</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Compare nearby schools quickly with map geometry, including a total selected path length.
                  </p>
                </div>
              </div>

              {statusMessage ? (
                <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {statusMessage}
                </p>
              ) : null}

              {selectedPlaces.length >= 2 ? (
                <p className="mt-4 text-sm text-slate-400">
                  Quick path summary: {selectedPlaces.map((place) => place.name).join(" → ")}.
                  Use the metrics panel for exact values like {formatDistanceLabel(1500)} style labels.
                </p>
              ) : null}
            </div>
        </div>
      </div>
    </main>
  );
}
