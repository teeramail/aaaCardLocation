"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import type { CardItemMediaRecord, CardItemRecord, CardRecord } from "@/components/dashboard-types";
import { trpc } from "@/trpc/react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

type ItemFormValues = {
  nameTitle: string;
  description: string;
  linkUrl: string;
  value: string;
  itemDate: string;
  media: CardItemMediaRecord | null;
};

const defaultValues: ItemFormValues = {
  nameTitle: "",
  description: "",
  linkUrl: "",
  value: "0",
  itemDate: "",
  media: null
};

function createValuesFromItem(item: CardItemRecord | null): ItemFormValues {
  if (!item) {
    return defaultValues;
  }

  return {
    nameTitle: item.nameTitle,
    description: item.description ?? "",
    linkUrl: item.linkUrl ?? "",
    value: String(item.value ?? 0),
    itemDate: item.itemDate ? new Date(item.itemDate).toISOString().split("T")[0] ?? "" : "",
    media: item.media
  };
}

async function fileToBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export function CardItemsPanel(props: { card: CardRecord }) {
  const { card } = props;
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ItemFormValues>(defaultValues);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const itemsQuery = trpc.cardItem.listByCardId.useQuery({ cardId: card.id });

  const invalidateItems = async () => {
    await utils.cardItem.listByCardId.invalidate({ cardId: card.id });
  };

  const createMutation = trpc.cardItem.create.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setUploadMessage(null);
      setFormValues(defaultValues);
      await invalidateItems();
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  const updateMutation = trpc.cardItem.update.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setUploadMessage(null);
      setEditingItemId(null);
      setFormValues(defaultValues);
      await invalidateItems();
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  const deleteMutation = trpc.cardItem.delete.useMutation({
    onSuccess: async () => {
      await invalidateItems();
    }
  });

  const uploadMediaMutation = trpc.cardItem.uploadMedia.useMutation({
    onError: (error) => {
      setFormError(error.message);
      setUploadMessage(null);
    }
  });

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [
        item.nameTitle,
        item.description ?? "",
        item.linkUrl ?? "",
        String(item.value),
        item.itemDate ? new Date(item.itemDate).toLocaleDateString() : "",
        item.media?.originalName ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  const totalValue = useMemo(() => filteredItems.reduce((sum, item) => sum + item.value, 0), [filteredItems]);

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    uploadMediaMutation.isPending;

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, items]
  );

  const startEditing = (item: CardItemRecord) => {
    setEditingItemId(item.id);
    setFormValues(createValuesFromItem(item));
    setFormError(null);
    setUploadMessage(null);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setFormValues(defaultValues);
    setFormError(null);
    setUploadMessage(null);
  };

  const submit = async () => {
    setFormError(null);
    const trimmedName = formValues.nameTitle.trim();
    if (!trimmedName) {
      setFormError("Name / title is required.");
      return;
    }

    const nextValue = Number(formValues.value || 0);
    if (Number.isNaN(nextValue) || nextValue < 0) {
      setFormError("Value must be a valid number.");
      return;
    }

    const payload = {
      nameTitle: trimmedName,
      description: formValues.description.trim() || null,
      linkUrl: formValues.linkUrl.trim() || null,
      value: nextValue,
      itemDate: formValues.itemDate ? new Date(`${formValues.itemDate}T00:00:00.000Z`) : null,
      media: formValues.media
    };

    if (editingItemId) {
      await updateMutation.mutateAsync({ id: editingItemId, ...payload });
      return;
    }

    await createMutation.mutateAsync({ cardId: card.id, ...payload });
  };

  const handleMediaFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setFormError("File size exceeds 10 MB.");
      return;
    }

    setFormError(null);
    setUploadMessage("Uploading media...");
    const fileBase64 = await fileToBase64(file);
    const uploaded = await uploadMediaMutation.mutateAsync({
      cardId: card.id,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileBase64
    });

    setFormValues((current) => ({ ...current, media: uploaded }));
    setUploadMessage(`Media ready: ${uploaded.originalName}`);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Card Content Tabs</p>
            <p className="text-xs text-slate-400">
              Add item rows with name/title, description, link, value, date, media, and DB timestamp.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-violet-400/30 bg-violet-500/10 p-1">
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white"
          >
            Item
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search items (name, description, link, value, date, media)"
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400 md:max-w-sm"
        />
        <span className="text-xs text-slate-400">{items.length} total rows</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Name / Title</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Media</th>
              <th className="px-3 py-2">DB Timestamp</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                  No item rows for this card.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isImage = item.media?.mimeType.startsWith("image/") ?? false;
                return (
                  <tr key={item.id} className="border-t border-white/10 align-top">
                    <td className="px-3 py-3 font-medium text-white">{item.nameTitle}</td>
                    <td className="px-3 py-3 text-slate-300">{item.description || "-"}</td>
                    <td className="px-3 py-3">
                      {item.linkUrl ? (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sky-300 hover:underline"
                        >
                          {item.linkUrl}
                        </a>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-emerald-300">{currencyFormatter.format(item.value)}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {item.itemDate ? new Date(item.itemDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-3 py-3">
                      {item.media ? (
                        <div className="space-y-2">
                          {isImage ? (
                            <a
                              href={item.media.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative block h-16 w-24 overflow-hidden rounded-lg border border-white/10"
                            >
                              <Image
                                src={item.media.url}
                                alt={item.media.originalName}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </a>
                          ) : (
                            <a
                              href={item.media.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-300 hover:underline"
                            >
                              Open file
                            </a>
                          )}
                          <div className="text-xs text-slate-400">{item.media.originalName}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate({ id: item.id })}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="border-t border-white/10 bg-slate-950/50">
            <tr>
              <td className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-white">Sum</td>
              <td className="px-3 py-3" colSpan={2} />
              <td className="px-3 py-3 font-semibold text-emerald-300">{currencyFormatter.format(totalValue)}</td>
              <td className="px-3 py-3" colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {editingItem ? "Edit item row" : "Add New Item Row"}
          </p>
          {editingItem ? (
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">1. Name / Title</span>
            <input
              value={formValues.nameTitle}
              onChange={(event) => setFormValues((current) => ({ ...current, nameTitle: event.target.value }))}
              placeholder="Invoice #123, Movie: Inception"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">2. Description</span>
            <input
              value={formValues.description}
              onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short details"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">3. Link URL</span>
            <input
              type="url"
              value={formValues.linkUrl}
              onChange={(event) => setFormValues((current) => ({ ...current, linkUrl: event.target.value }))}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">4. Value</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formValues.value}
              onChange={(event) => setFormValues((current) => ({ ...current, value: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">5. Date</span>
            <input
              type="date"
              value={formValues.itemDate}
              onChange={(event) => setFormValues((current) => ({ ...current, itemDate: event.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs text-slate-300">6. Media</span>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-dashed border-sky-400/30 bg-slate-950 px-3 py-2 text-xs text-sky-200 hover:bg-sky-500/10">
                Choose File
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    void handleMediaFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {formValues.media ? (
                <button
                  type="button"
                  onClick={() => setFormValues((current) => ({ ...current, media: null }))}
                  className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20"
                >
                  Remove media
                </button>
              ) : null}
            </div>
            {formValues.media ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300">
                <p>{formValues.media.originalName}</p>
                <a
                  href={formValues.media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-300 hover:underline"
                >
                  Open media
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {uploadMessage ? <p className="mt-3 text-xs text-sky-300">{uploadMessage}</p> : null}
        {formError ? (
          <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isBusy}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy ? "Saving..." : editingItem ? "Save item row" : "Add item row"}
          </button>
        </div>
      </div>
    </div>
  );
}
