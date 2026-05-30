import type { Place, PlaceImage } from "@/server/db/schema";

export type PlaceWithImages = Place & {
  images: PlaceImage[];
};

export type NormalizedPlace = Omit<Place, "latitude" | "longitude" | "budget"> & {
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  imageAlt: string | null;
  linkUrl: string | null;
  budget: number | null;
};

export function normalizePlace(place: PlaceWithImages): NormalizedPlace {
  const { images, latitude, longitude, budget, ...rest } = place;
  const primaryImage = images[0];

  return {
    ...rest,
    latitude: Number(latitude),
    longitude: Number(longitude),
    imageUrl: primaryImage?.imageUrl ?? null,
    imageAlt: primaryImage?.altText ?? null,
    linkUrl: rest.linkUrl ?? null,
    budget: budget !== null && budget !== undefined ? Number(budget) : null
  };
}
