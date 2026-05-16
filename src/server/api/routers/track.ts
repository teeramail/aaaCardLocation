import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { userTracks } from "@/server/db/schema";
import { trackInputSchema, type TrackPoint } from "@/server/api/schemas/track";

export const trackRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const tracks = await ctx.db.query.userTracks.findMany({
      where: eq(userTracks.userId, ctx.userId),
      orderBy: [desc(userTracks.createdAt)]
    });

    return tracks.map(track => ({
      id: track.id,
      userId: track.userId,
      name: track.name,
      points: track.points as TrackPoint[],
      createdAt: track.createdAt,
      updatedAt: track.updatedAt
    }));
  }),

  create: protectedProcedure.input(trackInputSchema).mutation(async ({ ctx, input }) => {
    const [createdTrack] = await ctx.db
      .insert(userTracks)
      .values({
        userId: ctx.userId,
        name: input.name,
        points: input.points
      })
      .returning();

    return {
      ...createdTrack,
      points: createdTrack.points as TrackPoint[]
    };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(userTracks)
        .where(and(eq(userTracks.id, input.id), eq(userTracks.userId, ctx.userId)))
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Track not found or you don't have permission to delete it."
        });
      }

      return { success: true };
    })
});
