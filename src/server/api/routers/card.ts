import { and, asc, desc, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { normalizePlace, type NormalizedPlace } from "@/server/api/place-data";
import { cardIdSchema, cardInputSchema, cardPlaceOptionsSchema } from "@/server/api/schemas/card";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { cards, placeImages, places } from "@/server/db/schema";

type CardWithPlace = typeof cards.$inferSelect & {
  place:
    | (typeof places.$inferSelect & {
        images: typeof placeImages.$inferSelect[];
      })
    | null;
};

type NormalizedCard = Omit<typeof cards.$inferSelect, "placeId"> & {
  placeId: string | null;
  linkUrl: string | null;
  description: string | null;
  notes: string | null;
  place: NormalizedPlace | null;
};

function normalizeCard(card: CardWithPlace): NormalizedCard {
  return {
    ...card,
    placeId: card.placeId ?? null,
    linkUrl: card.linkUrl ?? null,
    description: card.description ?? null,
    notes: card.notes ?? null,
    place: card.place
      ? normalizePlace({
          ...card.place,
          images: card.place.images
        })
      : null
  };
}

export const cardRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) {
      return [];
    }

    const cardRows = await ctx.db.query.cards.findMany({
      where: eq(cards.userId, ctx.ownerUserId),
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
      }
    });

    return card ? normalizeCard(card) : null;
  }),

  upsert: protectedProcedure.input(cardInputSchema).mutation(async ({ ctx, input }) => {
    const placeId = input.placeId ?? null;

    if (placeId) {
      const linkedPlace = await ctx.db.query.places.findFirst({
        where: and(eq(places.id, placeId), eq(places.userId, ctx.userId)),
        columns: { id: true }
      });

      if (!linkedPlace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The selected place was not found."
        });
      }

      const existingCard = await ctx.db.query.cards.findFirst({
        where: input.id
          ? and(eq(cards.placeId, placeId), eq(cards.userId, ctx.userId), ne(cards.id, input.id))
          : and(eq(cards.placeId, placeId), eq(cards.userId, ctx.userId)),
        columns: { id: true, title: true }
      });

      if (existingCard) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `This place is already linked to \"${existingCard.title}\".`
        });
      }
    }

    if (input.id) {
      const existingCard = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, input.id), eq(cards.userId, ctx.userId))
      });

      if (!existingCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The card you want to update was not found."
        });
      }

      const [updatedCard] = await ctx.db
        .update(cards)
        .set({
          title: input.title,
          description: input.description ?? null,
          notes: input.notes ?? null,
          linkUrl: input.linkUrl ?? null,
          placeId,
          updatedAt: new Date()
        })
        .where(and(eq(cards.id, input.id), eq(cards.userId, ctx.userId)))
        .returning();

      const refreshedCard = await ctx.db.query.cards.findFirst({
        where: and(eq(cards.id, updatedCard!.id), eq(cards.userId, ctx.userId)),
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
        }
      });

      if (!refreshedCard) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The updated card could not be reloaded."
        });
      }

      return normalizeCard(refreshedCard);
    }

    const [createdCard] = await ctx.db
      .insert(cards)
      .values({
        userId: ctx.userId,
        placeId,
        title: input.title,
        description: input.description ?? null,
        notes: input.notes ?? null,
        linkUrl: input.linkUrl ?? null
      })
      .returning();

    const fullCard = await ctx.db.query.cards.findFirst({
      where: and(eq(cards.id, createdCard!.id), eq(cards.userId, ctx.userId)),
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
      }
    });

    if (!fullCard) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The new card could not be loaded."
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

  placeOptions: protectedProcedure.input(cardPlaceOptionsSchema).query(async ({ ctx, input }) => {
    const linkedCards = await ctx.db.query.cards.findMany({
      where: eq(cards.userId, ctx.userId),
      columns: { id: true, placeId: true }
    });

    const allowedPlaceIds = new Set(
      linkedCards
        .filter((card) => card.placeId !== null && (!input?.cardId || card.id === input.cardId))
        .map((card) => card.placeId!)
    );

    const blockedPlaceIds = linkedCards
      .filter((card) => card.placeId !== null && (!input?.cardId || card.id !== input.cardId))
      .map((card) => card.placeId!) as string[];

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

    return placeRows
      .filter((place) => !blockedPlaceIds.includes(place.id) || allowedPlaceIds.has(place.id))
      .map((place) => normalizePlace(place));
  })
});
