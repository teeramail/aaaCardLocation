import { createTRPCRouter } from "@/server/api/trpc";
import { placeImageRouter } from "@/server/api/routers/place-image";
import { placeRouter } from "@/server/api/routers/place";
import { trackRouter } from "@/server/api/routers/track";

export const appRouter = createTRPCRouter({
  place: placeRouter,
  placeImage: placeImageRouter,
  track: trackRouter
});

export type AppRouter = typeof appRouter;
