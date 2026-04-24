import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { placeInputSchema, placeSelectionSchema } from "@/server/api/schemas/place";
import { samplePlaces } from "@/server/db/sample-places";
import { placeImages, places, users } from "@/server/db/schema";

function normalizePlace<T extends { latitude: string; longitude: string; images?: Array<{ imageUrl: string; altText: string | null }>; }>(place: T) {
  return {
    ...place,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    imageUrl: place.images?.[0]?.imageUrl ?? null,
    imageAlt: place.images?.[0]?.altText ?? null
  };
}

export const placeRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          ids: z.array(z.string().uuid()).optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const placeRows = await ctx.db.query.places.findMany({
        where: input?.ids?.length
          ? and(eq(places.userId, ctx.userId), inArray(places.id, input.ids))
          : eq(places.userId, ctx.userId),
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
    if (input.id) {
      const existingPlace = await ctx.db.query.places.findFirst({
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

      const [updatedPlace] = await ctx.db
        .update(places)
        .set({
          name: input.name,
          description: input.description ?? null,
          city: input.city ?? null,
          country: input.country ?? null,
          category: input.category,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          updatedAt: new Date()
        })
        .where(and(eq(places.id, input.id), eq(places.userId, ctx.userId)))
        .returning();

      return normalizePlace({
        ...updatedPlace,
        images: existingPlace.images
      });
    }

    const [createdPlace] = await ctx.db
      .insert(places)
      .values({
        userId: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        category: input.category,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString()
      })
      .returning();

    return normalizePlace({
      ...createdPlace,
      images: []
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deletedRows = await ctx.db
        .delete(places)
        .where(and(eq(places.id, input.id), eq(places.userId, ctx.userId)))
        .returning({ id: places.id });

      if (deletedRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The place you want to delete was not found."
        });
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
    const currentUser = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId)
    });

    if (!currentUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Could not resolve the signed-in user. Please sign in again."
      });
    }

    const existingPlaces = await ctx.db.query.places.findMany({
      where: eq(places.userId, currentUser.id),
      columns: {
        name: true,
        city: true
      }
    });

    const existingKeys = new Set(existingPlaces.map((place) => `${place.name}::${place.city ?? ""}`));
    const placesToInsert = samplePlaces.filter(
      (place) => !existingKeys.has(`${place.name}::${place.city ?? ""}`)
    );

    if (placesToInsert.length === 0) {
      return {
        created: 0
      };
    }

    await ctx.db.insert(places).values(
      placesToInsert.map((place) => ({
        userId: currentUser.id,
        name: place.name,
        description: place.description,
        city: place.city,
        country: place.country,
        category: place.category,
        latitude: place.latitude.toString(),
        longitude: place.longitude.toString()
      }))
    );

    return {
      created: placesToInsert.length
    };
  })
});
