import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import { auth } from "@/auth";
import { serverEnv } from "@/env-server";
import { db } from "@/server/db";

export async function createTRPCContext() {
  const session = await auth();
  const sessionUserId = session?.user?.id?.trim() ? session.user.id : null;
  const sessionUserEmail = session?.user?.email?.trim() ? session.user.email : null;

  let userId = sessionUserId;

  if (!userId && sessionUserEmail) {
    const matchedUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, sessionUserEmail)
    });

    userId = matchedUser?.id ?? null;
  }

  // The owner user is the account whose places are publicly visible.
  const ownerUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, serverEnv.VALID_EMAIL)
  });
  const ownerUserId = ownerUser?.id ?? null;

  return {
    db,
    session,
    userId,
    ownerUserId
  };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson
});

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to use this app."
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId
    }
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
