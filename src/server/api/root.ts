import { createTRPCRouter } from "@/server/api/trpc";
import { cardRouter } from "@/server/api/routers/card";
import { categoryRouter } from "@/server/api/routers/category";
import { placeImageRouter } from "@/server/api/routers/place-image";
import { placeRouter } from "@/server/api/routers/place";
import { trackRouter } from "@/server/api/routers/track";

export const appRouter = createTRPCRouter({
  card: cardRouter,
  category: categoryRouter,
  place: placeRouter,
  placeImage: placeImageRouter,
  track: trackRouter
});

export type AppRouter = typeof appRouter;
