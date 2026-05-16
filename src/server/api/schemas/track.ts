import { z } from "zod";

export const trackPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  ele: z.number().optional()
});

export const trackInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  points: z.array(trackPointSchema).min(2)
});

export type TrackPoint = z.infer<typeof trackPointSchema>;
export type TrackInput = z.infer<typeof trackInputSchema>;
