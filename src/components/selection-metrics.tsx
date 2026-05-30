"use client";

import { useMemo } from "react";

import type { PlaceRecord } from "@/components/dashboard-types";
import { calculateDistanceBetween, formatDistanceLabel } from "@/lib/utils";

export function SelectionMetrics(props: { places: PlaceRecord[] }) {
  const { totalDistance, segments, hasMain } = useMemo(() => {
    const empty = {
      totalDistance: 0,
      segments: [] as Array<{ from: string; to: string; distance: number }>,
      hasMain: false
    };

    const main = props.places.find((place) => place.isMain);
    if (!main) return empty;

    const others = props.places.filter((place) => place.id !== main.id);
    if (others.length === 0) return { ...empty, hasMain: true };

    const segments = others.map((place) => ({
      from: main.name,
      to: place.name,
      distance: calculateDistanceBetween(
        { lat: main.latitude, lng: main.longitude },
        { lat: place.latitude, lng: place.longitude }
      )
    }));

    return {
      totalDistance: segments.reduce((sum, segment) => sum + segment.distance, 0),
      segments,
      hasMain: true
    };
  }, [props.places]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      <h2 className="text-lg font-semibold text-white">Distance metrics</h2>
      <p className="mt-2 text-sm text-slate-400">
        Mark one place as <span className="font-medium text-emerald-300">Main</span> (green marker). All other markers (red) show their straight-line distance from it.
      </p>

      {!hasMain ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
          No main place set. Edit any place and tick &ldquo;Main place&rdquo; to start measuring.
        </div>
      ) : segments.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
          Add another place to compare distance from the main place.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm text-sky-100">Sum of distances from main</p>
            <p className="mt-1 text-2xl font-semibold text-white">{formatDistanceLabel(totalDistance)}</p>
          </div>

          {segments.map((segment) => (
            <div key={`${segment.from}-${segment.to}`} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-white">
                {segment.from} → {segment.to}
              </p>
              <p className="mt-1 text-sm text-slate-300">{formatDistanceLabel(segment.distance)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
