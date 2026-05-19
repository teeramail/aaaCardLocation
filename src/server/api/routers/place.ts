import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { placeInputSchema, placeSelectionSchema } from "@/server/api/schemas/place";
import { samplePlaces } from "@/server/db/sample-places";
import { dismissedSamples, placeImages, places, type Place, type PlaceImage } from "@/server/db/schema";

function buildSampleKey(name: string, city: string | null) {
  return `${name}::${city ?? ""}`;
}

const sampleKeySet = new Set(
  samplePlaces.map((place) => buildSampleKey(place.name, place.city))
);

type PlaceWithImages = Place & {
  images: PlaceImage[];
};

type NormalizedPlace = Omit<Place, "latitude" | "longitude" | "budget"> & {
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  imageAlt: string | null;
  linkUrl: string | null;
  budget: number | null;
};

function normalizePlace(place: PlaceWithImages): NormalizedPlace {
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

export const placeRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          ids: z.array(z.string().uuid()).optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.ownerUserId) {
        return [];
      }

      const placeRows = await ctx.db.query.places.findMany({
        where: input?.ids?.length
          ? and(eq(places.userId, ctx.ownerUserId), inArray(places.id, input.ids))
          : eq(places.userId, ctx.ownerUserId),
        with: {
          images: {
            where: eq(placeImages.isPrimary, true),
            orderBy: [desc(placeImages.createdAt)],
            limit: 1
          }
        },
        orderBy: [asc(places.name)]
      });

      return placeRows.map((place) => normalizePlace(place));
    }),
  upsert: protectedProcedure.input(placeInputSchema).mutation(async ({ ctx, input }) => {
    return await ctx.db.transaction(async (tx) => {
      if (input.isMain) {
        await tx
          .update(places)
          .set({ isMain: false })
          .where(
            input.id
              ? and(eq(places.userId, ctx.userId), ne(places.id, input.id))
              : eq(places.userId, ctx.userId)
          );
      }

      if (input.id) {
        const existingPlace = await tx.query.places.findFirst({
          where: and(eq(places.id, input.id), eq(places.userId, ctx.userId)),
          with: {
            images: {
              where: eq(placeImages.isPrimary, true),
              orderBy: [desc(placeImages.createdAt)],
              limit: 1
            }
          }
        });

        if (!existingPlace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The place you want to update was not found."
          });
        }

        const [updatedPlace] = await tx
          .update(places)
          .set({
            name: input.name,
            description: input.description ?? null,
            city: input.city ?? null,
            country: input.country ?? null,
            category: input.category,
            isMain: input.isMain,
            latitude: input.latitude.toString(),
            longitude: input.longitude.toString(),
            linkUrl: input.linkUrl ?? null,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            budget: input.budget !== undefined && input.budget !== null ? input.budget.toString() : null,
            updatedAt: new Date()
          })
          .where(and(eq(places.id, input.id), eq(places.userId, ctx.userId)))
          .returning();

        return normalizePlace({
          ...updatedPlace,
          images: existingPlace.images
        });
      }

      const [createdPlace] = await tx
        .insert(places)
        .values({
          userId: ctx.userId,
          name: input.name,
          description: input.description ?? null,
          city: input.city ?? null,
          country: input.country ?? null,
          category: input.category,
          isMain: input.isMain,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          linkUrl: input.linkUrl ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          budget: input.budget !== undefined && input.budget !== null ? input.budget.toString() : null
        })
        .returning();

      return normalizePlace({
        ...createdPlace,
        images: []
      });
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deletedRows = await ctx.db
        .delete(places)
        .where(and(eq(places.id, input.id), eq(places.userId, ctx.userId)))
        .returning({ id: places.id, name: places.name, city: places.city });

      if (deletedRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The place you want to delete was not found."
        });
      }

      const deletedRow = deletedRows[0]!;
      const key = buildSampleKey(deletedRow.name, deletedRow.city);
      if (sampleKeySet.has(key)) {
        await ctx.db
          .insert(dismissedSamples)
          .values({ userId: ctx.userId, sampleKey: key })
          .onConflictDoNothing();
      }

      return { success: true };
    }),
  bySelection: protectedProcedure.input(placeSelectionSchema).query(async ({ ctx, input }) => {
    if (input.ids.length === 0) {
      return [];
    }

    const selectedPlaces = await ctx.db.query.places.findMany({
      where: and(eq(places.userId, ctx.userId), inArray(places.id, input.ids)),
      with: {
        images: {
          where: eq(placeImages.isPrimary, true),
          orderBy: [desc(placeImages.createdAt)],
          limit: 1
        }
      },
      orderBy: [asc(places.name)]
    });

    return selectedPlaces.map((place) => normalizePlace(place));
  }),
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    const [existingPlaces, dismissedRows] = await Promise.all([
      ctx.db.query.places.findMany({
        where: eq(places.userId, ctx.userId),
        columns: { name: true, city: true }
      }),
      ctx.db.query.dismissedSamples.findMany({
        where: eq(dismissedSamples.userId, ctx.userId),
        columns: { sampleKey: true }
      })
    ]);

    const existingKeys = new Set(existingPlaces.map((place) => buildSampleKey(place.name, place.city)));
    const dismissedKeys = new Set(dismissedRows.map((row) => row.sampleKey));

    const placesToInsert = samplePlaces.filter((place) => {
      const key = buildSampleKey(place.name, place.city);
      return !existingKeys.has(key) && !dismissedKeys.has(key);
    });

    if (placesToInsert.length === 0) {
      return { created: 0 };
    }

    await ctx.db.insert(places).values(
      placesToInsert.map((place) => ({
        userId: ctx.userId,
        name: place.name,
        description: place.description,
        city: place.city,
        country: place.country,
        category: place.category,
        latitude: place.latitude.toString(),
        longitude: place.longitude.toString()
      }))
    );

    return { created: placesToInsert.length };
  })
});
