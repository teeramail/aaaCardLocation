"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PlaceRecord } from "@/components/dashboard-shell";
import { convertToWebp, blobToBase64 } from "@/lib/image-utils";
import { trpc } from "@/trpc/react";

const defaultValues = {
  name: "",
  description: "",
  city: "",
  country: "",
  isMain: false,
  latitude: "",
  longitude: "",
  linkUrl: "",
  dueDate: "",
  budget: ""
} as const;

type FormValues = {
  name: string;
  description: string;
  city: string;
  country: string;
  isMain: boolean;
  latitude: string;
  longitude: string;
  linkUrl: string;
  dueDate: string;
  budget: string;
};

function createValuesFromPlace(place: PlaceRecord | null): FormValues {
  if (!place) {
    return { ...defaultValues };
  }

  return {
    name: place.name,
    description: place.description ?? "",
    city: place.city ?? "",
    country: place.country ?? "",
    isMain: place.isMain,
    latitude: place.latitude.toString(),
    longitude: place.longitude.toString(),
    linkUrl: place.linkUrl ?? "",
    dueDate: place.dueDate ? new Date(place.dueDate).toISOString().slice(0, 10) : "",
    budget: place.budget !== null && place.budget !== undefined ? place.budget.toString() : ""
  };
}

export function PlaceForm(props: {
  editingPlace: PlaceRecord | null;
  onCancelEdit: () => void;
  onSaved: (message: string) => Promise<void>;
  formId?: string;
  hideSubmit?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => createValuesFromPlace(props.editingPlace));
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const upsertMutation = trpc.place.upsert.useMutation({
    onSuccess: async (createdPlace) => {
      setFormError(null);

      // If we have an image blob and a placeId, upload it after place is saved
      if (imageBlob && createdPlace?.id) {
        const base64 = await blobToBase64(imageBlob);
        uploadMutation.mutate({
          placeId: createdPlace.id,
          fileName: `place-${Date.now()}.webp`,
          mimeType: "image/webp",
          fileBase64: base64
        });
      } else {
        setValues(createValuesFromPlace(null));
        setImagePreview(null);
        setImageBlob(null);
        await props.onSaved(props.editingPlace ? "Place updated." : "Place created.");
      }
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  const uploadMutation = trpc.placeImage.upload.useMutation({
    onSuccess: async () => {
      setUploadMessage("Image uploaded.");
      setImagePreview(null);
      setImageBlob(null);
      setValues(createValuesFromPlace(null));
      await utils.place.list.invalidate();
      await props.onSaved(props.editingPlace ? "Place updated with image." : "Place created with image.");
    },
    onError: (error) => {
      setUploadMessage(error.message);
    }
  });

  const processImage = useCallback(async (source: File | Blob) => {
    setIsConverting(true);
    setUploadMessage(null);
    try {
      const { blob, dataUrl } = await convertToWebp(source);
      setImageBlob(blob);
      setImagePreview(dataUrl);
      setUploadMessage(`Image ready: ${(blob.size / 1024).toFixed(1)} KB (WebP)`);
    } catch {
      setUploadMessage("Failed to process the image.");
    } finally {
      setIsConverting(false);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void processImage(file);
    }
  };

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            void processImage(blob);
          }
          return;
        }
      }
    },
    [processImage]
  );

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleCoordinatePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").trim();
    if (!text.includes(",")) return;

    const parts = text.split(",").map((part) => part.trim());
    if (parts.length !== 2) return;

    const [latPart, lngPart] = parts;
    if (!latPart || !lngPart) return;

    const lat = Number(latPart);
    const lng = Number(lngPart);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    event.preventDefault();
    setValues((current) => ({
      ...current,
      latitude: latPart,
      longitude: lngPart
    }));
  };

  useEffect(() => {
    setValues(createValuesFromPlace(props.editingPlace));
    setImagePreview(null);
    setImageBlob(null);
    setFormError(null);
    setUploadMessage(null);
  }, [props.editingPlace]);

  const isBusy = upsertMutation.isPending || uploadMutation.isPending || isConverting;

  const { onBusyChange } = props;
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  return (
    <div ref={formRef} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      {!props.hideSubmit ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {props.editingPlace ? "Edit place" : "Add a new place"}
            </h2>
            <p className="text-sm text-slate-400">
              Save the school or place coordinates. You can attach an image and a link.
            </p>
          </div>
          {props.editingPlace ? (
            <button
              type="button"
              onClick={props.onCancelEdit}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        id={props.formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const latitude = Number(values.latitude);
          const longitude = Number(values.longitude);

          if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            setFormError("Latitude and longitude must be valid numbers.");
            return;
          }

          const budget = values.budget ? Number(values.budget) : null;
          if (values.budget && Number.isNaN(budget)) {
            setFormError("Budget must be a valid number.");
            return;
          }

          upsertMutation.mutate({
            id: props.editingPlace?.id,
            name: values.name,
            description: values.description || null,
            city: values.city || null,
            country: values.country || null,
            isMain: values.isMain,
            latitude,
            longitude,
            linkUrl: values.linkUrl || null,
            dueDate: values.dueDate || null,
            budget: budget
          });
        }}
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Name</span>
          <input
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="checkbox"
            checked={values.isMain}
            onChange={(event) =>
              setValues((current) => ({ ...current, isMain: event.target.checked }))
            }
            className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-400"
          />
          <span className="text-sm text-slate-200">
            <span className="font-medium text-white">Main place</span>
            <span className="ml-2 text-xs text-slate-400">
              Marker turns green and distances are measured from here. Only one main place is allowed.
            </span>
          </span>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea
            value={values.description}
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">City</span>
            <input
              value={values.city}
              onChange={(event) => setValues((current) => ({ ...current, city: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Country</span>
            <input
              value={values.country}
              onChange={(event) => setValues((current) => ({ ...current, country: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Latitude</span>
            <input
              value={values.latitude}
              onChange={(event) => setValues((current) => ({ ...current, latitude: event.target.value }))}
              onPaste={handleCoordinatePaste}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Longitude</span>
            <input
              value={values.longitude}
              onChange={(event) => setValues((current) => ({ ...current, longitude: event.target.value }))}
              onPaste={handleCoordinatePaste}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Tip: paste &ldquo;lat, lng&rdquo; from Google Maps (e.g. 13.668639, 100.651863) into either field to fill both automatically.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Due date <span className="text-xs font-normal text-slate-500">(optional)</span></span>
            <input
              type="date"
              value={values.dueDate}
              onChange={(event) => setValues((current) => ({ ...current, dueDate: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400 [color-scheme:dark] cursor-pointer"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Budget <span className="text-xs font-normal text-slate-500">(optional)</span></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.budget}
              onChange={(event) => setValues((current) => ({ ...current, budget: event.target.value }))}
              placeholder="0.00"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Link URL</span>
          <input
            type="url"
            value={values.linkUrl}
            onChange={(event) => setValues((current) => ({ ...current, linkUrl: event.target.value }))}
            placeholder="https://example.com"
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-sky-400"
          />
          <p className="text-xs text-slate-400">Optional link to associate with this place.</p>
        </label>

        {/* Image section */}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <span className="text-sm font-medium text-slate-200">Place image</span>
          <p className="text-xs text-slate-400">
            Upload, paste from clipboard, or take a photo. Auto-converted to WebP (&lt; 100 KB).
          </p>

          {/* Existing image preview */}
          {props.editingPlace?.imageUrl && !imagePreview ? (
            <div className="relative h-40 overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={props.editingPlace.imageUrl}
                alt={props.editingPlace.imageAlt ?? props.editingPlace.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          {/* New image preview */}
          {imagePreview ? (
            <div className="relative h-40 overflow-hidden rounded-2xl border border-sky-400/30">
              <Image
                src={imagePreview}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageBlob(null);
                  setUploadMessage(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {/* File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isConverting}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Choose file
            </button>

            {/* Camera capture button */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isConverting}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Take photo
            </button>

            <span className="self-center text-xs text-slate-500">or paste an image (Ctrl+V)</span>
          </div>

          {isConverting ? (
            <p className="text-xs text-sky-300">Converting to WebP...</p>
          ) : null}
        </div>

        {formError ? (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        {uploadMessage ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            {uploadMessage}
          </p>
        ) : null}

        {!props.hideSubmit ? (
          <button
            type="submit"
            disabled={isBusy}
            className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy
              ? props.editingPlace
                ? "Saving..."
                : "Creating..."
              : props.editingPlace
                ? "Save changes"
                : "Create place"}
          </button>
        ) : null}
      </form>
    </div>
  );
}
