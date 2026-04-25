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
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activePlace = useMemo(
    () => props.places.find((place) => place.id === activeId) ?? null,
    [activeId, props.places]
  );

  const path = useMemo(
    () =>
      props.places.map((place) => ({
        lat: place.latitude,
        lng: place.longitude
      })),
    [props.places]
  );

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
              title={place.name}
              opacity={props.selectedIds.length === 0 || props.selectedIds.includes(place.id) ? 1 : 0.5}
            />
          ))}

          {activePlace ? (
            <InfoWindow
              position={{ lat: activePlace.latitude, lng: activePlace.longitude }}
              onCloseClick={() => setActiveId(null)}
              pixelOffset={[0, -34]}
            >
              <div style={{ minWidth: 180, color: "#0f172a" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{activePlace.name}</div>
                {activePlace.city || activePlace.country ? (
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    {[activePlace.city, activePlace.country].filter(Boolean).join(", ")}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    props.onToggleSelect(activePlace.id);
                  }}
                  style={{
                    marginTop: 8,
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
              </div>
            </InfoWindow>
          ) : null}

          {path.length >= 2 ? (
            <Polyline
              path={path}
              strokeColor="#38bdf8"
              strokeOpacity={0.8}
              strokeWeight={3}
            />
          ) : null}
        </Map>
      </div>
    </APIProvider>
  );
}
