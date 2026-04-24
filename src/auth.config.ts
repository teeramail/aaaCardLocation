import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no DB, no Node-only modules).
 * Used by middleware. The full config in `src/auth.ts` extends this.
 */
export const authConfig = {
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      const publicPrefixes = ["/login", "/api/auth", "/api/trpc", "/dashboard"];
      const isPublic = pathname === "/" || publicPrefixes.some((path) => pathname.startsWith(path));

      if (isPublic) {
        return true;
      }

      return isLoggedIn;
    }
  }
} satisfies NextAuthConfig;
