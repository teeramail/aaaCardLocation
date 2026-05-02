"use client";

import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  Polyline,
  useMap
} from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";

import { clientEnv } from "@/env-client";
import type { PlaceRecord } from "@/components/dashboard-shell";
import { trpc } from "@/trpc/react";

function FitBounds(props: { places: PlaceRecord[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || props.places.length === 0) {
      return;
    }

    if (props.places.length === 1) {
      const place = props.places[0]!;
      map.panTo({ lat: place.latitude, lng: place.longitude });
      map.setZoom(13);
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    props.places.forEach((place) => {
      bounds.extend({ lat: place.latitude, lng: place.longitude });
    });

    map.fitBounds(bounds, 120);
  }, [map, props.places]);

  return null;
}

export function PlacesMap(props: {
  places: PlaceRecord[];
  selectedIds: string[];
  onToggleSelect: (placeId: string) => void;
  onEditPlace?: (place: PlaceRecord) => void;
  onPlaceSaved?: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isEditingPopup, setIsEditingPopup] = useState(false);
  const [popupValues, setPopupValues] = useState({
    name: "",
    description: "",
    city: "",
    country: "",
    isMain: false,
    latitude: "",
    longitude: ""
  });
  const [popupError, setPopupError] = useState<string | null>(null);

  const upsertMutation = trpc.place.upsert.useMutation({
    onSuccess: async () => {
      setIsEditingPopup(false);
      setPopupError(null);
      await props.onPlaceSaved?.();
    },
    onError: (error) => {
      setPopupError(error.message);
    }
  });

  const activePlace = useMemo(
    () => props.places.find((place) => place.id === activeId) ?? null,
    [activeId, props.places]
  );

  const mainPlace = useMemo(
    () => props.places.find((place) => place.isMain) ?? null,
    [props.places]
  );

  useEffect(() => {
    if (!activePlace) {
      setIsEditingPopup(false);
      return;
    }

    setPopupValues({
      name: activePlace.name,
      description: activePlace.description ?? "",
      city: activePlace.city ?? "",
      country: activePlace.country ?? "",
      isMain: activePlace.isMain,
      latitude: activePlace.latitude.toString(),
      longitude: activePlace.longitude.toString()
    });
    setPopupError(null);
  }, [activePlace]);

  const distancePaths = useMemo(() => {
    if (!mainPlace) {
      return [] as Array<{ id: string; path: Array<{ lat: number; lng: number }> }>;
    }
    const origin = { lat: mainPlace.latitude, lng: mainPlace.longitude };
    return props.places
      .filter((place) => place.id !== mainPlace.id)
      .map((place) => ({
        id: place.id,
        path: [origin, { lat: place.latitude, lng: place.longitude }]
      }));
  }, [mainPlace, props.places]);

  const defaultCenter = props.places[0]
    ? { lat: props.places[0].latitude, lng: props.places[0].longitude }
    : { lat: 13.7563, lng: 100.5018 };

  return (
    <APIProvider apiKey={clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} libraries={["geometry"]}>
      <div className="h-[520px] overflow-hidden rounded-3xl border border-white/10">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={5}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId={clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          style={{ width: "100%", height: "100%" }}
        >
          <FitBounds places={props.places} />

          {props.places.map((place) => (
            <Marker
              key={place.id}
              position={{ lat: place.latitude, lng: place.longitude }}
              onClick={() => setActiveId(place.id)}
              title={place.isMain ? `${place.name} (Main)` : place.name}
              icon={
                place.isMain
                  ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                  : "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
              }
              zIndex={place.isMain ? 999 : undefined}
              opacity={props.selectedIds.length === 0 || props.selectedIds.includes(place.id) ? 1 : 0.5}
            />
          ))}

          {activePlace ? (
            <InfoWindow
              position={{ lat: activePlace.latitude, lng: activePlace.longitude }}
              onCloseClick={() => setActiveId(null)}
              pixelOffset={[0, -34]}
            >
              <div style={{ minWidth: isEditingPopup ? 280 : 180, color: "#0f172a" }}>
                {isEditingPopup ? (
                  <form
                    style={{ display: "grid", gap: 8 }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const latitude = Number(popupValues.latitude);
                      const longitude = Number(popupValues.longitude);

                      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
                        setPopupError("Latitude and longitude must be valid numbers.");
                        return;
                      }

                      upsertMutation.mutate({
                        id: activePlace.id,
                        name: popupValues.name,
                        description: popupValues.description || null,
                        city: popupValues.city || null,
                        country: popupValues.country || null,
                        isMain: popupValues.isMain,
                        latitude,
                        longitude
                      });
                    }}
                  >
                    <input
                      value={popupValues.name}
                      onChange={(event) => setPopupValues((current) => ({ ...current, name: event.target.value }))}
                      required
                      placeholder="Name"
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                    <textarea
                      value={popupValues.description}
                      onChange={(event) => setPopupValues((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Description"
                      rows={2}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        value={popupValues.city}
                        onChange={(event) => setPopupValues((current) => ({ ...current, city: event.target.value }))}
                        placeholder="City"
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                      />
                      <input
                        value={popupValues.country}
                        onChange={(event) => setPopupValues((current) => ({ ...current, country: event.target.value }))}
                        placeholder="Country"
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        value={popupValues.latitude}
                        onChange={(event) => setPopupValues((current) => ({ ...current, latitude: event.target.value }))}
                        placeholder="Latitude"
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                      />
                      <input
                        value={popupValues.longitude}
                        onChange={(event) => setPopupValues((current) => ({ ...current, longitude: event.target.value }))}
                        placeholder="Longitude"
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                      />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={popupValues.isMain}
                        onChange={(event) => setPopupValues((current) => ({ ...current, isMain: event.target.checked }))}
                      />
                      Main place
                    </label>
                    {popupError ? <div style={{ color: "#be123c", fontSize: 12 }}>{popupError}</div> : null}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={upsertMutation.isPending}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #0ea5e9",
                          background: "#0ea5e9",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        {upsertMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPopup(false)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#334155",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{activePlace.name}</div>
                    {activePlace.city || activePlace.country ? (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        {[activePlace.city, activePlace.country].filter(Boolean).join(", ")}
                      </div>
                    ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    flexWrap: "wrap"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      props.onToggleSelect(activePlace.id);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #0ea5e9",
                      background: props.selectedIds.includes(activePlace.id) ? "#0ea5e9" : "#fff",
                      color: props.selectedIds.includes(activePlace.id) ? "#fff" : "#0ea5e9",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {props.selectedIds.includes(activePlace.id) ? "Deselect" : "Select"}
                  </button>
                  {props.onEditPlace ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPopup(true);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #0f172a",
                        background: "#0f172a",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                  </>
                )}
              </div>
            </InfoWindow>
          ) : null}

          {distancePaths.map((segment) => (
            <Polyline
              key={segment.id}
              path={segment.path}
              strokeColor="#38bdf8"
              strokeOpacity={0.8}
              strokeWeight={3}
            />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}
