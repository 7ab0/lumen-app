import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Pruebas unitarias de la lógica de negocio (src/lib) — no requieren
// base de datos ni el servidor de Next.js levantado. Ver PLAN.md,
// "Próximos pasos": pruebas unitarias de amortización, mora y score.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
