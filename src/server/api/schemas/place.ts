import { z } from "zod";

export const placeCategoryValues = [
  "primary_school",
  "secondary_school",
  "university",
  "office",
  "home",
  "other"
] as const;

export const placeCategorySchema = z.enum(placeCategoryValues);

export const placeInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  category: placeCategorySchema.default("primary_school"),
  isMain: z.boolean().optional().default(false),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  linkUrl: z.string().url().max(2000).optional().nullable()
});

export const placeSelectionSchema = z.object({
  ids: z.array(z.string().uuid()).default([])
});

export type PlaceInput = z.infer<typeof placeInputSchema>;
