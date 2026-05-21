import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { placeCategories } from "@/server/db/schema";

export const DEFAULT_CATEGORIES = [
  { slug: "primary_school", label: "Primary School", color: "sky", sortOrder: 0 },
  { slug: "secondary_school", label: "Secondary School", color: "violet", sortOrder: 1 },
  { slug: "university", label: "University", color: "amber", sortOrder: 2 },
  { slug: "office", label: "Office", color: "emerald", sortOrder: 3 },
  { slug: "home", label: "Home", color: "rose", sortOrder: 4 },
  { slug: "other", label: "Other", color: "slate", sortOrder: 5 }
];

function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export const categoryRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.ownerUserId) {
      return DEFAULT_CATEGORIES.map((c, i) => ({
        ...c,
        id: `default-${i}`,
        userId: "",
        createdAt: new Date()
      }));
    }

    const rows = await ctx.db.query.placeCategories.findMany({
      where: eq(placeCategories.userId, ctx.ownerUserId),
      orderBy: [asc(placeCategories.sortOrder), asc(placeCategories.label)]
    });

    if (rows.length === 0) {
      const seeded = await ctx.db
        .insert(placeCategories)
        .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: ctx.ownerUserId! })))
        .returning();
      return seeded;
    }

    return rows;
  }),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().trim().min(1).max(120),
        color: z.string().min(1).max(32).default("slate"),
        sortOrder: z.number().int().min(0).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = labelToSlug(input.label) || "category";

      if (input.id) {
        const existing = await ctx.db.query.placeCategories.findFirst({
          where: and(eq(placeCategories.id, input.id), eq(placeCategories.userId, ctx.userId))
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const [updated] = await ctx.db
          .update(placeCategories)
          .set({ label: input.label, slug, color: input.color })
          .where(and(eq(placeCategories.id, input.id), eq(placeCategories.userId, ctx.userId)))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(placeCategories)
        .values({
          userId: ctx.userId,
          label: input.label,
          slug,
          color: input.color,
          sortOrder: input.sortOrder ?? 99
        })
        .returning();
      return created;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.placeCategories.findFirst({
        where: and(eq(placeCategories.id, input.id), eq(placeCategories.userId, ctx.userId))
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const all = await ctx.db.query.placeCategories.findMany({
        where: eq(placeCategories.userId, ctx.userId),
        columns: { id: true }
      });
      if (all.length <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the last category." });
      }

      await ctx.db
        .delete(placeCategories)
        .where(and(eq(placeCategories.id, input.id), eq(placeCategories.userId, ctx.userId)));

      return { deleted: true };
    })
});
