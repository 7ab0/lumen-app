import type { NextAuthConfig } from "next-auth";

// Config "liviana" de Auth.js: nada de Prisma ni bcrypt acá, para que
// src/proxy.ts (que corre en el middleware) pueda armar su propia
// instancia de NextAuth sin arrastrar el motor nativo de Prisma al
// bundle del middleware (Netlify no permite C++ addons ahí). El
// proveedor Credentials con el authorize() real vive en src/lib/auth.ts.
export default {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "COBRADOR";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
