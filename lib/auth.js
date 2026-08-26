// lib/auth.js
// NextAuth configuration (Google OAuth provider + Prisma adapter).
//
// CRITICAL SECURITY NOTE (see TRD section 4):
// The authenticated user's ID must always come from the server-side
// session (getServerSession), never from a client-supplied `userId` field.
// Every API route in this project reads the user id via
// `session.user.id`, which is populated below in the `session` callback
// from the JWT `sub` claim.

import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./db";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid || token.sub;
      }
      return session;
    },
  },
  pages: {
    // Use the default NextAuth sign-in page. Override here if a custom
    // /login page is added later.
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
