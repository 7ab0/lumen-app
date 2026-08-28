import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

// Instancia liviana de NextAuth propia del middleware: usa authConfig
// (sin Prisma ni bcrypt) para que el motor nativo de Prisma no termine
// empaquetado en el bundle del middleware — Netlify no permite C++
// addons ahí (ver src/lib/auth.config.ts).
const { auth } = NextAuth(authConfig);

// Rutas exclusivas del Administrador (dashboard de cartera, log de
// auditoría, gestión de cobradores). Todo lo demás autenticado es
// accesible tanto para ADMIN como para COBRADOR (cada uno ve su propia
// cartera filtrada a nivel de datos, no de ruta).
const ADMIN_ONLY_PREFIXES = ["/dashboard", "/auditoria", "/cobradores"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";
  const isAuthed = !!req.auth;

  if (!isAuthed && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isAuthed &&
    req.auth?.user?.role !== "ADMIN" &&
    ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // api/jobs queda fuera: el cron de Vercel llama a /api/jobs/mora sin
  // cookie de sesión (se autentica con CRON_SECRET dentro de la propia
  // ruta) — si el proxy lo interceptara, redirigiría esa llamada a
  // /login en vez de dejar correr el job.
  matcher: [
    "/((?!api/auth|api/jobs|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)",
  ],
};
