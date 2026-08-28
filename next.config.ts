import type { NextConfig } from "next";

// Nota sobre la PWA: Next.js 16 usa Turbopack por defecto para `next dev`
// y `next build`, y los plugins de PWA basados en webpack (p. ej.
// @serwist/next) todavía no son compatibles con Turbopack. Para evitar
// ese conflicto, el service worker de Lumen se escribió a mano como
// archivo estático en public/sw.js en vez de generarse en el build —
// ver ese archivo y src/components/pwa-register.tsx.
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
