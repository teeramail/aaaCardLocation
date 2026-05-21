"use client";

import { useCallback, useMemo, useState } from "react";

import type { PlaceRecord } from "@/components/dashboard-shell";
import { getColorClasses } from "@/components/category-manager";
import { trpc } from "@/trpc/react";

type SortField =
  | "name"
  | "city"
  | "country"
  | "category"
  | "budget"
  | "dueDate"
  | "latitude"
  | "longitude"
  | "createdAt";

type SortDirection = "asc" | "desc";

function formatCoord(value: number, decimals = 5): string {
  return value.toFixed(decimals);
}

function formatDate(date: Date | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatBudget(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function comparePlaces(
  a: PlaceRecord,
  b: PlaceRecord,
  field: SortField,
  direction: SortDirection
): number {
  const dir = direction === "asc" ? 1 : -1;

  switch (field) {
    case "name":
      return dir * a.name.localeCompare(b.name);
    case "city":
      return dir * (a.city ?? "").localeCompare(b.city ?? "");
    case "country":
      return dir * (a.country ?? "").localeCompare(b.country ?? "");
    case "category":
      return dir * a.category.localeCompare(b.category);
    case "budget": {
      const aBudget = a.budget ?? -Infinity;
      const bBudget = b.budget ?? -Infinity;
      return dir * (aBudget - bBudget);
    }
    case "dueDate": {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
      return dir * (aTime - bTime);
    }
    case "latitude":
      return dir * (a.latitude - b.latitude);
    case "longitude":
      return dir * (a.longitude - b.longitude);
    case "createdAt": {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return dir * (aTime - bTime);
    }
    default:
      return 0;
  }
}

function SortIcon(props: { field: SortField; activeField: SortField; direction: SortDirection }) {
  if (props.field !== props.activeField) {
    return (
      <svg className="ml-1 inline-block h-3 w-3 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3l4 5H4l4-5zm0 10l-4-5h8l-4 5z" />
      </svg>
    );
  }

  return props.direction === "asc" ? (
    <svg className="ml-1 inline-block h-3 w-3 text-sky-400" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3l5 6H3l5-6z" />
    </svg>
  ) : (
    <svg className="ml-1 inline-block h-3 w-3 text-sky-400" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 13l-5-6h10l-5 6z" />
    </svg>
  );
}

type Column = {
  field: SortField;
  label: string;
  className?: string;
};

const COLUMNS: Column[] = [
  { field: "name", label: "Name" },
  { field: "city", label: "City" },
  { field: "country", label: "Country" },
  { field: "category", label: "Category" },
  { field: "latitude", label: "Lat", className: "text-right" },
  { field: "longitude", label: "Lng", className: "text-right" },
  { field: "budget", label: "Budget", className: "text-right" },
  { field: "dueDate", label: "Due Date" },
  { field: "createdAt", label: "Created" }
];

function CategoryBadge(props: { slug: string }) {
  const categoriesQuery = trpc.category.list.useQuery();
  const cat = categoriesQuery.data?.find((c) => c.slug === props.slug);
  const colorInfo = getColorClasses(cat?.color ?? "slate");
  const label = cat?.label ?? props.slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorInfo.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colorInfo.dot}`} />
      {label}
    </span>
  );
}

export function PlacesTable(props: {
  places: PlaceRecord[];
  selectedIds: string[];
  onToggleSelect: (placeId: string) => void;
  onExpandPlace?: (place: PlaceRecord) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const sorted = useMemo(
    () =>
      [...props.places].sort((a, b) =>
        comparePlaces(a, b, sortField, sortDirection)
      ),
    [props.places, sortField, sortDirection]
  );

  const allSelected =
    props.places.length > 0 &&
    props.places.every((p) => props.selectedIds.includes(p.id));

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      props.places.forEach((p) => props.onToggleSelect(p.id));
    } else {
      props.places
        .filter((p) => !props.selectedIds.includes(p.id))
        .forEach((p) => props.onToggleSelect(p.id));
    }
  }, [allSelected, props]);

  if (props.places.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Places table</h2>
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
          No places to display.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Places table</h2>
          <p className="text-sm text-slate-400">
            Click any column header to sort &middot; {sorted.length} place{sorted.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Sorted by <span className="font-medium text-white">{COLUMNS.find((c) => c.field === sortField)?.label}</span>
          <span className="text-slate-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/80">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleAll}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-400"
                />
              </th>
              <th className="w-8 px-1 py-3" />
              {COLUMNS.map((col) => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:text-sky-300 ${col.className ?? ""}`}
                >
                  {col.label}
                  <SortIcon field={col.field} activeField={sortField} direction={sortDirection} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((place) => {
              const isSelected = props.selectedIds.includes(place.id);

              return (
                <tr
                  key={place.id}
                  className={
                    isSelected
                      ? "bg-sky-500/10 transition hover:bg-sky-500/15"
                      : "transition hover:bg-white/5"
                  }
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => props.onToggleSelect(place.id)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-400"
                    />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    {place.isMain ? (
                      <span
                        className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                        title="Main place"
                      />
                    ) : (
                      <span className="inline-block h-3 w-3 rounded-full border border-white/20" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {props.onExpandPlace ? (
                      <button
                        type="button"
                        onClick={() => props.onExpandPlace?.(place)}
                        className="font-medium text-sky-300 transition hover:text-sky-200 hover:underline"
                      >
                        {place.name}
                      </button>
                    ) : (
                      <span className="font-medium text-white">{place.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{place.city ?? "\u2014"}</td>
                  <td className="px-3 py-2.5 text-slate-300">{place.country ?? "\u2014"}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge slug={place.category} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400">
                    {formatCoord(place.latitude)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-400">
                    {formatCoord(place.longitude)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-300">
                    {formatBudget(place.budget)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                    {formatDate(place.dueDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                    {formatDate(place.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
