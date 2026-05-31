import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { isObjectStorageEnabled } from "@/env-server";
import { deleteStoredFile, uploadUserFile } from "@/lib/upload";
import {
  cardItemCreateSchema,
  cardItemIdSchema,
  cardItemListByCardIdSchema,
  cardItemMediaSchema,
  cardItemUpdateSchema,
  cardItemUploadMediaSchema,
  type CardItemMediaInput
} from "@/server/api/schemas/card-item";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { cardItems, cards } from "@/server/db/schema";

function parseItemMedia(rawMedia: string | null): CardItemMediaInput {
  if (!rawMedia) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawMedia) as unknown;
    const validated = cardItemMediaSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function normalizeCardItem(item: typeof cardItems.$inferSelect) {
  return {
    ...item,
    description: item.description ?? null,
    linkUrl: item.linkUrl ?? null,
    value: typeof item.value === "number" ? item.value : Number(item.value ?? 0),
    itemDate: item.itemDate ?? null,
    media: parseItemMedia(item.media ?? null)
  };
}

async function ensureOwnedCard(params: {
  db: typeof import("@/server/db").db;
  cardId: string;
  userId: string;
}) {
  const card = await params.db.query.cards.findFirst({
    where: and(eq(cards.id, params.cardId), eq(cards.userId, params.userId)),
    columns: { id: true }
  });

  if (!card) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "The selected card was not found."
    });
  }

  return card;
}

export const cardItemRouter = createTRPCRouter({
  listByCardId: publicProcedure.input(cardItemListByCardIdSchema).query(async ({ ctx, input }) => {
    const targetUserId = ctx.userId ?? ctx.ownerUserId;
    if (!targetUserId) {
      return [];
    }

    const card = await ctx.db.query.cards.findFirst({
      where: and(eq(cards.id, input.cardId), eq(cards.userId, targetUserId)),
      columns: { id: true }
    });

    if (!card) {
      return [];
    }

    const items = await ctx.db.query.cardItems.findMany({
      where: eq(cardItems.cardId, input.cardId),
      orderBy: [desc(cardItems.createdAt), desc(cardItems.id)]
    });

    return items.map((item) => normalizeCardItem(item));
  }),

  create: protectedProcedure.input(cardItemCreateSchema).mutation(async ({ ctx, input }) => {
    await ensureOwnedCard({ db: ctx.db, cardId: input.cardId, userId: ctx.userId });

    const [created] = await ctx.db
      .insert(cardItems)
      .values({
        cardId: input.cardId,
        nameTitle: input.nameTitle.trim(),
        description: input.description?.trim() || null,
        linkUrl: input.linkUrl?.trim() || null,
        value: String(input.value ?? 0),
        itemDate: input.itemDate ?? null,
        media: input.media ? JSON.stringify(input.media) : null
      })
      .returning();

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create item."
      });
    }

    return normalizeCardItem(created);
  }),

  update: protectedProcedure.input(cardItemUpdateSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .select({
        id: cardItems.id,
        cardId: cardItems.cardId,
        media: cardItems.media,
        userId: cards.userId
      })
      .from(cardItems)
      .innerJoin(cards, eq(cardItems.cardId, cards.id))
      .where(eq(cardItems.id, input.id))
      .limit(1);

    const existingItem = existing[0];
    if (!existingItem || existingItem.userId !== ctx.userId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The item was not found."
      });
    }

    const payload: Partial<typeof cardItems.$inferInsert> = {};
    if (input.nameTitle !== undefined) payload.nameTitle = input.nameTitle.trim();
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.linkUrl !== undefined) payload.linkUrl = input.linkUrl?.trim() || null;
    if (input.value !== undefined) payload.value = String(input.value);
    if (input.itemDate !== undefined) payload.itemDate = input.itemDate ?? null;

    let mediaToDelete: string | null = null;
    if (input.media !== undefined) {
      payload.media = input.media ? JSON.stringify(input.media) : null;
      const previousMedia = parseItemMedia(existingItem.media ?? null);
      const nextKey = input.media?.storageKey ?? null;
      if (previousMedia?.storageKey && previousMedia.storageKey !== nextKey) {
        mediaToDelete = previousMedia.storageKey;
      }
    }

    const [updated] = await ctx.db
      .update(cardItems)
      .set(payload)
      .where(eq(cardItems.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The item was not found."
      });
    }

    if (mediaToDelete) {
      try {
        await deleteStoredFile(mediaToDelete);
      } catch {
      }
    }

    return normalizeCardItem(updated);
  }),

  delete: protectedProcedure.input(cardItemIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .select({
        id: cardItems.id,
        media: cardItems.media,
        userId: cards.userId
      })
      .from(cardItems)
      .innerJoin(cards, eq(cardItems.cardId, cards.id))
      .where(eq(cardItems.id, input.id))
      .limit(1);

    const existingItem = existing[0];
    if (!existingItem || existingItem.userId !== ctx.userId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "The item was not found."
      });
    }

    await ctx.db.delete(cardItems).where(eq(cardItems.id, input.id));

    const media = parseItemMedia(existingItem.media ?? null);
    if (media?.storageKey) {
      try {
        await deleteStoredFile(media.storageKey);
      } catch {
      }
    }

    return { success: true };
  }),

  uploadMedia: protectedProcedure.input(cardItemUploadMediaSchema).mutation(async ({ ctx, input }) => {
    if (!isObjectStorageEnabled) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Object storage is not configured."
      });
    }

    await ensureOwnedCard({ db: ctx.db, cardId: input.cardId, userId: ctx.userId });

    const { key, fileUrl } = await uploadUserFile({
      userId: ctx.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileBuffer: Buffer.from(input.fileBase64, "base64"),
      subfolder: "card-items"
    });

    return {
      fileName: input.fileName,
      originalName: input.fileName,
      mimeType: input.mimeType,
      fileSize: Buffer.from(input.fileBase64, "base64").byteLength,
      storageKey: key,
      url: fileUrl,
      subfolder: "card-items"
    };
  })
});
