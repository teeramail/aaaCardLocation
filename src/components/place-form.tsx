"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { PlaceRecord } from "@/components/dashboard-shell";
import { trpc } from "@/trpc/react";

const defaultValues = {
  name: "",
  description: "",
  city: "",
  country: "",
  isMain: false,
  latitude: "",
  longitude: ""
} as const;

type FormValues = {
  name: string;
  description: string;
  city: string;
  country: string;
  isMain: boolean;
  latitude: string;
  longitude: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function createValuesFromPlace(place: PlaceRecord | null): FormValues {
  if (!place) {
    return {
      ...defaultValues
    };
  }

  return {
    name: place.name,
    description: place.description ?? "",
    city: place.city ?? "",
    country: place.country ?? "",
    isMain: place.isMain,
    latitude: place.latitude.toString(),
    longitude: place.longitude.toString()
  };
}

export function PlaceForm(props: {
  editingPlace: PlaceRecord | null;
  onCancelEdit: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => createValuesFromPlace(props.editingPlace));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const upsertMutation = trpc.place.upsert.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setValues(createValuesFromPlace(null));
      setUploadFile(null);
      await props.onSaved(props.editingPlace ? "Place updated." : "Place created.");
    },
    onError: (error) => {
      setFormError(error.message);
    }
  });

  const uploadMutation = trpc.placeImage.upload.useMutation({
    onSuccess: async () => {
      setUploadMessage("Image uploaded.");
      setUploadFile(null);
      await utils.place.list.invalidate();
    },
    onError: (error) => {
      setUploadMessage(error.message);
    }
  });

  const handleCoordinatePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").trim();
    if (!text.includes(",")) {
      return;
    }

    const parts = text.split(",").map((part) => part.trim());
    if (parts.length !== 2) {
      return;
    }

    const [latPart, lngPart] = parts;
    if (!latPart || !lngPart) {
      return;
    }

    const lat = Number(latPart);
    const lng = Number(lngPart);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    event.preventDefault();
    setValues((current) => ({
      ...current,
      latitude: latPart,
      longitude: lngPart
    }));
  };

  useEffect(() => {
    setValues(createValuesFromPlace(props.editingPlace));
    setUploadFile(null);
    setFormError(null);
    setUploadMessage(null);
  }, [props.editingPlace]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-sky-950/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {props.editingPlace ? "Edit place" : "Add a new place"}
          </h2>
          <p className="text-sm text-slate-400">
            Save the school or place coordinates, then optionally attach one image.
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

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const latitude = Number(values.latitude);
          const longitude = Number(values.longitude);

          if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            setFormError("Latitude and longitude must be valid numbers.");
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
            longitude
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

        {formError ? (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={upsertMutation.isPending}
          className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {upsertMutation.isPending
            ? props.editingPlace
              ? "Saving changes..."
              : "Creating place..."
            : props.editingPlace
              ? "Save changes"
              : "Create place"}
        </button>
      </form>

      {props.editingPlace ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Place image</h3>
          <p className="mt-2 text-sm text-slate-400">Upload one image to show in the place card and details.</p>

          {props.editingPlace.imageUrl ? (
            <div className="relative mt-4 h-48 overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={props.editingPlace.imageUrl}
                alt={props.editingPlace.imageAlt ?? props.editingPlace.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200"
            />
            <button
              type="button"
              disabled={!uploadFile || uploadMutation.isPending}
              onClick={() => {
                if (!uploadFile || !props.editingPlace) {
                  return;
                }

                uploadFile
                  .arrayBuffer()
                  .then((buffer) => {
                    uploadMutation.mutate({
                      placeId: props.editingPlace!.id,
                      fileName: uploadFile.name,
                      mimeType: uploadFile.type,
                      fileBase64: arrayBufferToBase64(buffer)
                    });
                  })
                  .catch(() => {
                    setUploadMessage("Unable to read the selected file.");
                  });
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload image"}
            </button>
          </div>

          {uploadMessage ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {uploadMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
