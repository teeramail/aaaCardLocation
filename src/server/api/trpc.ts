import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import { auth } from "@/auth";
import { serverEnv } from "@/env-server";
import { ensureUser } from "@/server/auth/sync-user";
import { db } from "@/server/db";

// Cache the owner user ID to avoid a DB query on every request.
let cachedOwnerUserId: string | null = null;

async function resolveOwnerUserId(): Promise<string | null> {
  if (cachedOwnerUserId) {
    const cachedOwnerId = cachedOwnerUserId;
    const cachedOwner = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, cachedOwnerId),
      columns: { id: true }
    });

    if (cachedOwner) {
      return cachedOwner.id;
    }

    cachedOwnerUserId = null;
  }

  const ownerUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, serverEnv.VALID_EMAIL),
    columns: { id: true }
  });

  if (ownerUser) {
    cachedOwnerUserId = ownerUser.id;
    return cachedOwnerUserId;
  }

  const ensuredOwner = await ensureUser({
    email: serverEnv.VALID_EMAIL,
    name: serverEnv.VALID_EMAIL.split("@")[0] ?? "Owner"
  });

  cachedOwnerUserId = ensuredOwner.id;
  return cachedOwnerUserId;
}

export async function createTRPCContext() {
  const session = await auth();
  const sessionUserId = session?.user?.id?.trim() ? session.user.id : null;
  const sessionUserEmail = session?.user?.email?.trim() ? session.user.email : null;
  const sessionUserName = session?.user?.name?.trim() ? session.user.name : null;
  const sessionUserImage = session?.user?.image ?? null;

  let userId: string | null = null;

  if (sessionUserId) {
    const currentSessionUserId = sessionUserId;
    const matchedUserById = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, currentSessionUserId),
      columns: { id: true }
    });

    userId = matchedUserById?.id ?? null;
  }

  if (!userId && sessionUserEmail) {
    const matchedUserByEmail = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, sessionUserEmail),
      columns: { id: true }
    });

    if (matchedUserByEmail) {
      userId = matchedUserByEmail.id;
    } else {
      const ensuredUser = await ensureUser({
        email: sessionUserEmail,
        name: sessionUserName ?? sessionUserEmail.split("@")[0] ?? "Owner",
        image: sessionUserImage
      });

      userId = ensuredUser.id;
    }
  }

  const ownerUserId = await resolveOwnerUserId();

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
