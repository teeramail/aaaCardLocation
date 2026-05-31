import { z } from "zod";

export const cardInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(4000).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
    linkUrl: z.string().url().max(2000).optional().nullable(),
    placeIds: z.array(z.string().uuid()).max(200).optional().default([]),
    primaryPlaceId: z.string().uuid().optional().nullable()
  })
  .refine(
    (value) => !value.primaryPlaceId || (value.placeIds ?? []).includes(value.primaryPlaceId),
    {
      message: "The primary location must be one of the linked locations.",
      path: ["primaryPlaceId"]
    }
  );

export const cardIdSchema = z.object({
  id: z.string().uuid()
});

export const cardPlaceOptionsSchema = z
  .object({
    cardId: z.string().uuid().optional()
  })
  .optional();

export type CardInput = z.infer<typeof cardInputSchema>;
