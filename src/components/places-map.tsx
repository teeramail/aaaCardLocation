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
import type { MapMouseEvent } from "@vis.gl/react-google-maps";

import { clientEnv } from "@/env-client";
import type { PlaceRecord } from "@/components/dashboard-shell";
import { trpc } from "@/trpc/react";
import { calculateDistanceBetween } from "@/lib/utils";

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
  tracks?: Array<{ id: string; name: string; points: Array<{ lat: number; lng: number; ele?: number }> }>;
  selectedIds: string[];
  onToggleSelect: (placeId: string) => void;
  onEditPlace?: (place: PlaceRecord) => void;
  onPlaceSaved?: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isEditingPopup, setIsEditingPopup] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lng: number;
    ele?: number;
    slope?: number;
    trackName: string;
  } | null>(null);
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

  const handleMouseMove = (e: MapMouseEvent) => {
    if (!e.detail.latLng || !props.tracks || props.tracks.length === 0) return;
    
    const mouseLat = e.detail.latLng.lat;
    const mouseLng = e.detail.latLng.lng;
    
    let closestPointInfo: typeof hoveredPoint = null;
    let minDistance = 100; // max snap distance in meters

    props.tracks.forEach(track => {
      for (let i = 0; i < track.points.length; i++) {
        const pt = track.points[i];
        if (!pt) continue;

        const dist = calculateDistanceBetween({lat: mouseLat, lng: mouseLng}, pt);
        
        if (dist < minDistance) {
          minDistance = dist;
          
          let slope: number | undefined = undefined;
          
          // calculate slope to the NEXT point
          if (i < track.points.length - 1) {
            const nextPt = track.points[i+1];
            if (nextPt && pt.ele !== undefined && nextPt.ele !== undefined) {
              const segDist = calculateDistanceBetween(pt, nextPt);
              if (segDist > 0) {
                slope = ((nextPt.ele - pt.ele) / segDist) * 100; // percentage
              }
            }
          } else if (i > 0) {
             // last point, calculate slope from previous
            const prevPt = track.points[i-1];
            if (prevPt && pt.ele !== undefined && prevPt.ele !== undefined) {
              const segDist = calculateDistanceBetween(prevPt, pt);
              if (segDist > 0) {
                slope = ((pt.ele - prevPt.ele) / segDist) * 100;
              }
            }
          }
          
          closestPointInfo = {
            lat: pt.lat,
            lng: pt.lng,
            ele: pt.ele,
            slope,
            trackName: track.name
          };
        }
      }
    });
    
    setHoveredPoint(closestPointInfo);
  };

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
      <div className="relative h-[520px] overflow-hidden rounded-3xl border border-white/10">
        {hoveredPoint ? (
          <div className="pointer-events-none absolute right-4 top-4 z-10 w-48 rounded-2xl border border-sky-400/20 bg-slate-950/90 p-4 shadow-xl backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">Road Data</div>
            <div className="mt-1 truncate text-sm font-medium text-white" title={hoveredPoint.trackName}>
              {hoveredPoint.trackName}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase text-slate-400">Elevation</div>
                <div className="font-mono text-sm font-medium text-emerald-300">
                  {hoveredPoint.ele !== undefined ? `${hoveredPoint.ele.toFixed(1)}m` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Slope</div>
                <div className="font-mono text-sm font-medium text-amber-300">
                  {hoveredPoint.slope !== undefined ? `${hoveredPoint.slope > 0 ? '+' : ''}${hoveredPoint.slope.toFixed(1)}%` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Map
          defaultCenter={defaultCenter}
          defaultZoom={5}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId={clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          style={{ width: "100%", height: "100%" }}
          onMousemove={handleMouseMove}
          onMouseout={() => setHoveredPoint(null)}
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
                    {activePlace.imageUrl ? (
                      <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activePlace.imageUrl}
                          alt={activePlace.imageAlt ?? activePlace.name}
                          style={{ width: "100%", maxHeight: 140, objectFit: "cover", display: "block" }}
                        />
                      </div>
                    ) : null}
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{activePlace.name}</div>
                    {activePlace.city || activePlace.country ? (
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        {[activePlace.city, activePlace.country].filter(Boolean).join(", ")}
                      </div>
                    ) : null}
                    {activePlace.linkUrl ? (
                      <a
                        href={activePlace.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "#0ea5e9", marginTop: 4, display: "inline-block", wordBreak: "break-all" }}
                      >
                        {activePlace.linkUrl.length > 40
                          ? `${activePlace.linkUrl.slice(0, 40)}...`
                          : activePlace.linkUrl}
                      </a>
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

          {props.tracks?.map((track) => (
            <Polyline
              key={`track-${track.id}`}
              path={track.points}
              strokeColor="#fbbf24"
              strokeOpacity={0.9}
              strokeWeight={4}
            />
          ))}

          {hoveredPoint ? (
            <Marker
              position={{ lat: hoveredPoint.lat, lng: hoveredPoint.lng }}
              icon="https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
              zIndex={1000}
              clickable={false}
            />
          ) : null}
        </Map>
      </div>
    </APIProvider>
  );
}
