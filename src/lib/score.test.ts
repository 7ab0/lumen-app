import { beforeEach, describe, expect, it, vi } from "vitest";

// recalcularScore toca la base de datos directamente (prisma.installment.findMany
// y prisma.client.update), así que para probar la REGLA de negocio (los
// umbrales A/B/C/D) sin una base real, se mockea el módulo de prisma y se
// controla lo que "findMany" devuelve en cada caso.
// vi.mock se "hoistea" arriba de los imports, así que las funciones que
// referencia adentro deben crearse con vi.hoisted para existir a tiempo.
const { findMany, update } = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    installment: { findMany },
    client: { update },
  },
}));

const { recalcularScore } = await import("./score");

function installment(status: "PAGADA" | "ATRASADA" | "PENDIENTE" | "PARCIAL", wasLate = false) {
  return { status, wasLate };
}

beforeEach(() => {
  findMany.mockReset();
  update.mockReset();
});

describe("recalcularScore", () => {
  it("da A cuando el 100% de las cuotas decididas se pagaron a tiempo", async () => {
    findMany.mockResolvedValue([installment("PAGADA"), installment("PAGADA"), installment("PAGADA")]);

    const score = await recalcularScore("client-1");

    expect(score).toBe("A");
    expect(update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { score: "A", scoreUpdatedAt: expect.any(Date) },
    });
  });

  it("sin cuotas decididas todavía (cliente nuevo), asume 100% y da A", async () => {
    findMany.mockResolvedValue([installment("PENDIENTE")]);

    expect(await recalcularScore("client-1")).toBe("A");
  });

  it("da B entre 80% y 94% de puntualidad", async () => {
    // 8 de 10 a tiempo = 80%
    const decididas = [
      ...Array(8).fill(installment("PAGADA")),
      ...Array(2).fill(installment("PAGADA", true)), // pagada pero fue tarde alguna vez
    ];
    findMany.mockResolvedValue(decididas);

    expect(await recalcularScore("client-1")).toBe("B");
  });

  it("da C entre 60% y 79% de puntualidad", async () => {
    const decididas = [
      ...Array(6).fill(installment("PAGADA")),
      ...Array(4).fill(installment("PAGADA", true)),
    ];
    findMany.mockResolvedValue(decididas);

    expect(await recalcularScore("client-1")).toBe("C");
  });

  it("da D por debajo de 60% de puntualidad", async () => {
    const decididas = [
      ...Array(3).fill(installment("PAGADA")),
      ...Array(7).fill(installment("PAGADA", true)),
    ];
    findMany.mockResolvedValue(decididas);

    expect(await recalcularScore("client-1")).toBe("D");
  });

  it("una mora activa baja el score al menos a C aunque el historial sea bueno", async () => {
    const historialBueno = Array(9).fill(installment("PAGADA"));
    findMany.mockResolvedValue([...historialBueno, installment("ATRASADA")]);

    // 9/10 a tiempo = 90% (sería B), pero la mora activa lo baja a C
    expect(await recalcularScore("client-1")).toBe("C");
  });

  it("una mora activa con historial malo da D, no C", async () => {
    const historialMalo = Array(9).fill(installment("PAGADA", true));
    findMany.mockResolvedValue([...historialMalo, installment("ATRASADA")]);

    expect(await recalcularScore("client-1")).toBe("D");
  });
});
