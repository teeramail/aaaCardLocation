import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { isGoogleAuthEnabled, serverEnv } from "@/env-server";
import { ensureUser } from "@/server/auth/sync-user";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      if (
        parsed.data.email !== serverEnv.VALID_EMAIL ||
        parsed.data.password !== serverEnv.VALID_PASSWORD
      ) {
        return null;
      }

      const user = await ensureUser({
        email: parsed.data.email,
        name: parsed.data.email.split("@")[0] ?? "Owner"
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      };
    }
  })
];

if (isGoogleAuthEnabled) {
  providers.push(
    Google({
      clientId: serverEnv.AUTH_GOOGLE_ID!,
      clientSecret: serverEnv.AUTH_GOOGLE_SECRET!
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: serverEnv.AUTH_SECRET,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      await ensureUser({
        email: user.email,
        name: user.name ?? user.email.split("@")[0] ?? "Owner",
        image: user.image
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const ensuredUser = await ensureUser({
          email: user.email,
          name: user.name ?? user.email.split("@")[0] ?? "Owner",
          image: user.image
        });

        token.userId = ensuredUser.id;
        token.email = ensuredUser.email;
        token.name = ensuredUser.name;
        token.picture = ensuredUser.image ?? undefined;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.name = typeof token.name === "string" ? token.name : "";
        session.user.image = typeof token.picture === "string" ? token.picture : null;
      }

      return session;
    }
  }
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}
