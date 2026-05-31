import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { normalizePlace, type NormalizedPlace } from "@/server/api/place-data";
import { cardIdSchema, cardInputSchema, cardPlaceOptionsSchema } from "@/server/api/schemas/card";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { cardLocations, cards, placeImages, places } from "@/server/db/schema";

type CardLocationWithPlace = typeof cardLocations.$inferSelect & {
  place: typeof places.$inferSelect & {
    images: typeof placeImages.$inferSelect[];
  };
};

type CardWithLocations = typeof cards.$inferSelect & {
  locations: CardLocationWithPlace[];
};

type NormalizedCard = typeof cards.$inferSelect & {
  linkUrl: string | null;
  description: string | null;
  notes: string | null;
  places: NormalizedPlace[];
  primaryPlaceId: string | null;
  primaryPlace: NormalizedPlace | null;
};

function normalizeCard(card: CardWithLocations): NormalizedCard {
  const sortedLinks = [...card.locations].sort((a, b) => a.sortOrder - b.sortOrder);
  const places = sortedLinks.map((link) =>
    normalizePlace({
      ...link.place,
      images: link.place.images
    })
  );
  const primaryLink = sortedLinks.find((link) => link.isPrimary) ?? null;
  const primaryPlace = primaryLink
    ? normalizePlace({ ...primaryLink.place, images: primaryLink.place.images })
    : places[0] ?? null;

  return {
    ...card,
    linkUrl: card.linkUrl ?? null,
    description: card.description ?? null,
    notes: card.notes ?? null,
    places,
    primaryPlaceId: primaryPlace?.id ?? null,
    primaryPlace
  };
}

const cardLocationsWith = {
  locations: {
    with: {
      place: {
        with: {
          images: {
            where: eq(placeImages.isPrimary, true),
            orderBy: [desc(placeImages.createdAt)],
            limit: 1
          }
        }
      }
    },
    orderBy: [asc(cardLocations.sortOrder)]
  }
};

export const cardRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) {
      return [];
    }

    const cardRows = await ctx.db.query.cards.findMany({
      where: eq(cards.userId, ctx.ownerUserId),
      with: cardLocationsWith,
      orderBy: [desc(cards.updatedAt), desc(cards.createdAt)]
    });

    return cardRows.map((card) => normalizeCard(card));
  }),

  byId: publicProcedure.input(cardIdSchema).query(async ({ ctx, input }) => {
    const targetUserId = ctx.userId ?? ctx.ownerUserId;
    if (!targetUserId) {
      return null;
    }

    const card = await ctx.db.query.cards.findFirst({
      where: and(eq(cards.id, input.id), eq(cards.userId, targetUserId)),
      with: cardLocationsWith
    });

    return card ? normalizeCard(card) : null;
  }),

  upsert: protectedProcedure.input(cardInputSchema).mutation(async ({ ctx, input }) => {
    const placeIds = Array.from(new Set(input.placeIds ?? []));
    const primaryPlaceId = input.primaryPlaceId ?? null;

    if (placeIds.length > 0) {
      const ownedPlaces = await ctx.db.query.places.findMany({
        where: and(eq(places.userId, ctx.userId), inArray(places.id, placeIds)),
        columns: { id: true }
      });

      if (ownedPlaces.length !== placeIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more selected locations were not found."
        });
      }
    }

    const resolvedPrimaryId =
      primaryPlaceId && placeIds.includes(primaryPlaceId)
        ? primaryPlaceId
        : placeIds[0] ?? null;

    const cardId = await ctx.db.transaction(async (tx) => {
      let targetCardId: string;

      if (input.id) {
        const existingCard = await tx.query.cards.findFirst({
          where: and(eq(cards.id, input.id), eq(cards.userId, ctx.userId)),
          columns: { id: true }
        });

        if (!existingCard) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The card you want to update was not found."
          });
        }

        await tx
          .update(cards)
          .set({
            title: input.title,
            description: input.description ?? null,
            notes: input.notes ?? null,
            linkUrl: input.linkUrl ?? null,
            updatedAt: new Date()
          })
          .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.userId)));

        targetCardId = input.id;
        await tx.delete(cardLocations).where(eq(cardLocations.cardId, targetCardId));
      } else {
        const [createdCard] = await tx
          .insert(cards)
          .values({
            userId: ctx.userId,
            title: input.title,
            description: input.description ?? null,
            notes: input.notes ?? null,
            linkUrl: input.linkUrl ?? null
          })
          .returning({ id: cards.id });

        targetCardId = createdCard!.id;
      }

      if (placeIds.length > 0) {
        await tx.insert(cardLocations).values(
          placeIds.map((placeId, index) => ({
            cardId: targetCardId,
            placeId,
            isPrimary: placeId === resolvedPrimaryId,
            sortOrder: index
          }))
        );
      }

      return targetCardId;
    });

    const fullCard = await ctx.db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.userId, ctx.userId)),
      with: cardLocationsWith
    });

    if (!fullCard) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The saved card could not be loaded."
      });
    }

    return normalizeCard(fullCard);
  }),

  delete: protectedProcedure.input(cardIdSchema).mutation(async ({ ctx, input }) => {
    const deletedRows = await ctx.db
      .delete(cards)
      .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.userId)))
      .returning({ id: cards.id });

    if (deletedRows.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The card you want to delete was not found."
      });
    }

    return { success: true };
  }),

  placeOptions: protectedProcedure.input(cardPlaceOptionsSchema).query(async ({ ctx }) => {
    const placeRows = await ctx.db.query.places.findMany({
      where: eq(places.userId, ctx.userId),
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
  })
});
