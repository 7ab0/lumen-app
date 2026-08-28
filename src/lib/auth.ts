import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";

// Límite de intentos fallidos de login antes de bloquear temporalmente
// la cuenta (ver plan, sección "Seguridad de acceso").
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Bloqueo temporal por intentos fallidos
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error(
            "Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta más tarde."
          );
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : attempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
                : user.lockedUntil,
            },
          });
          return null;
        }

        // Login exitoso: resetear contador de intentos fallidos
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
