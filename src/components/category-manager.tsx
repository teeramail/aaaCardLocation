"use client";

import { useEffect, useRef, useState } from "react";

import { trpc } from "@/trpc/react";

export const COLOR_OPTIONS = [
  { value: "sky", label: "Blue", dot: "bg-sky-400", badge: "bg-sky-500/20 text-sky-300" },
  { value: "violet", label: "Purple", dot: "bg-violet-400", badge: "bg-violet-500/20 text-violet-300" },
  { value: "emerald", label: "Green", dot: "bg-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  { value: "amber", label: "Yellow", dot: "bg-amber-400", badge: "bg-amber-500/20 text-amber-300" },
  { value: "rose", label: "Red", dot: "bg-rose-400", badge: "bg-rose-500/20 text-rose-300" },
  { value: "teal", label: "Teal", dot: "bg-teal-400", badge: "bg-teal-500/20 text-teal-300" },
  { value: "orange", label: "Orange", dot: "bg-orange-400", badge: "bg-orange-500/20 text-orange-300" },
  { value: "pink", label: "Pink", dot: "bg-pink-400", badge: "bg-pink-500/20 text-pink-300" },
  { value: "slate", label: "Gray", dot: "bg-slate-400", badge: "bg-slate-500/20 text-slate-300" }
] as const;

export type ColorValue = (typeof COLOR_OPTIONS)[number]["value"];

export function getColorClasses(color: string) {
  return (
    COLOR_OPTIONS.find((c) => c.value === color) ??
    COLOR_OPTIONS[COLOR_OPTIONS.length - 1]!
  );
}

function ColorPicker(props: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => props.onChange(c.value)}
          className={`h-6 w-6 rounded-full transition ${c.dot} ${props.value === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" : "opacity-60 hover:opacity-100"}`}
        />
      ))}
    </div>
  );
}

type CategoryRow = {
  id: string;
  label: string;
  slug: string;
  color: string;
  sortOrder: number;
};

function CategoryItem(props: {
  category: CategoryRow;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(props.category.label);
  const [color, setColor] = useState(props.category.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const colorInfo = getColorClasses(props.category.color);

  const upsert = trpc.category.upsert.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.category.list.invalidate();
      props.onSaved();
    }
  });

  const remove = trpc.category.delete.useMutation({
    onSuccess: async () => {
      setConfirmDelete(false);
      await utils.category.list.invalidate();
      props.onSaved();
    }
  });

  useEffect(() => {
    if (editing) {
      setLabel(props.category.label);
      setColor(props.category.color);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, props.category.label, props.category.color]);

  if (editing) {
    return (
      <div className="space-y-3 rounded-2xl border border-sky-400/30 bg-sky-500/5 p-3">
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={120}
          placeholder="Category name"
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={upsert.isPending || !label.trim()}
            onClick={() => upsert.mutate({ id: props.category.id, label: label.trim(), color })}
            className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
        {upsert.error ? (
          <p className="text-xs text-rose-300">{upsert.error.message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/50 px-3 py-2.5">
      <span className={`h-3 w-3 shrink-0 rounded-full ${colorInfo.dot}`} />
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorInfo.badge}`}>
        {props.category.label}
      </span>
      <span className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5"
        >
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: props.category.id })}
              className="rounded-lg bg-rose-500/20 px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
            >
              {remove.isPending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5"
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-rose-400/20 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10"
          >
            Delete
          </button>
        )}
      </span>
      {remove.error ? (
        <p className="w-full text-xs text-rose-300">{remove.error.message}</p>
      ) : null}
    </div>
  );
}

function AddCategoryForm(props: { onAdded: () => void }) {
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("sky");

  const upsert = trpc.category.upsert.useMutation({
    onSuccess: async () => {
      setLabel("");
      setColor("sky");
      await utils.category.list.invalidate();
      props.onAdded();
    }
  });

  return (
    <form
      className="space-y-3 rounded-2xl border border-dashed border-white/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        upsert.mutate({ label: label.trim(), color });
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Add new category</p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
        placeholder="Category name"
        className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
      />
      <ColorPicker value={color} onChange={setColor} />
      {upsert.error ? (
        <p className="text-xs text-rose-300">{upsert.error.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={upsert.isPending || !label.trim()}
        className="w-full rounded-xl bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {upsert.isPending ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}

export function CategoryManager(props: { open: boolean; onClose: () => void }) {
  const categoriesQuery = trpc.category.list.useQuery();
  const categories = categoriesQuery.data ?? [];

  useEffect(() => {
    if (!props.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-end justify-end bg-slate-950/60 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="relative flex h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-950 shadow-2xl sm:h-auto sm:max-h-[80vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/80 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Manage Categories</h2>
            <p className="text-xs text-slate-400">Add, rename, recolor, or remove categories</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {categoriesQuery.isLoading ? (
            <p className="text-center text-sm text-slate-400">Loading…</p>
          ) : (
            categories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                onSaved={() => undefined}
              />
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 p-4">
          <AddCategoryForm onAdded={() => undefined} />
        </div>
      </div>
    </div>
  );
}
