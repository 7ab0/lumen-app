import { describe, expect, it } from "vitest";
import {
  buildInstallmentPlan,
  calcularInteresPeriodo,
  plazoPactadoVencido,
  primeraCuotaInteresSolo,
  siguienteCuotaInteresSolo,
  siguienteFechaPeriodo,
} from "./amortization";

describe("siguienteFechaPeriodo", () => {
  const base = new Date("2026-01-15T00:00:00Z");

  it("suma 7 días en SEMANAL", () => {
    expect(siguienteFechaPeriodo(base, "SEMANAL").toISOString()).toBe(
      new Date("2026-01-22T00:00:00Z").toISOString()
    );
  });

  it("suma 15 días en QUINCENAL", () => {
    expect(siguienteFechaPeriodo(base, "QUINCENAL").toISOString()).toBe(
      new Date("2026-01-30T00:00:00Z").toISOString()
    );
  });

  it("suma 1 mes en MENSUAL", () => {
    expect(siguienteFechaPeriodo(base, "MENSUAL").toISOString()).toBe(
      new Date("2026-02-15T00:00:00Z").toISOString()
    );
  });
});

describe("buildInstallmentPlan (CUOTA_FIJA)", () => {
  it("genera una cuota por mes cuando la frecuencia es MENSUAL", () => {
    const plan = buildInstallmentPlan({
      principal: 900,
      interestRatePercentPerPeriod: 10,
      termMonths: 3,
      frequency: "MENSUAL",
      startDate: new Date("2026-01-01T00:00:00Z"),
    });

    expect(plan).toHaveLength(3);
    // Interés simple: 900 * 10% * 3 = 270 -> total 1170 / 3 = 390 exacto
    expect(plan.map((p) => p.amountDue)).toEqual([390, 390, 390]);
    expect(plan.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(plan[0].dueDate.toISOString()).toBe(new Date("2026-02-01T00:00:00Z").toISOString());
    expect(plan[2].dueDate.toISOString()).toBe(new Date("2026-04-01T00:00:00Z").toISOString());
  });

  it("multiplica los periodos por 4 al mes en SEMANAL y por 2 en QUINCENAL", () => {
    const semanal = buildInstallmentPlan({
      principal: 1000,
      interestRatePercentPerPeriod: 5,
      termMonths: 1,
      frequency: "SEMANAL",
      startDate: new Date("2026-01-01T00:00:00Z"),
    });
    expect(semanal).toHaveLength(4);

    const quincenal = buildInstallmentPlan({
      principal: 1000,
      interestRatePercentPerPeriod: 5,
      termMonths: 1,
      frequency: "QUINCENAL",
      startDate: new Date("2026-01-01T00:00:00Z"),
    });
    expect(quincenal).toHaveLength(2);
  });

  it("la última cuota absorbe la diferencia de redondeo y la suma cuadra exacto", () => {
    const plan = buildInstallmentPlan({
      principal: 100,
      interestRatePercentPerPeriod: 7,
      termMonths: 3,
      frequency: "MENSUAL",
      startDate: new Date("2026-01-01T00:00:00Z"),
    });

    // Interés: 100 * 7% * 3 = 21 -> total 121 / 3 = 40.333...
    expect(plan[0].amountDue).toBe(40.33);
    expect(plan[1].amountDue).toBe(40.33);
    expect(plan[2].amountDue).toBe(40.34); // absorbe el centavo restante

    const suma = plan.reduce((acc, p) => acc + p.amountDue, 0);
    expect(Math.round(suma * 100) / 100).toBe(121);
  });

  it("nunca genera menos de 1 periodo aunque termMonths sea muy chico", () => {
    const plan = buildInstallmentPlan({
      principal: 100,
      interestRatePercentPerPeriod: 10,
      termMonths: 0.1,
      frequency: "MENSUAL",
      startDate: new Date("2026-01-01T00:00:00Z"),
    });
    expect(plan.length).toBeGreaterThanOrEqual(1);
  });
});

describe("calcularInteresPeriodo (INTERES_SOLO)", () => {
  it("calcula el interés simple sobre el saldo", () => {
    expect(calcularInteresPeriodo(1500, 10)).toBe(150);
  });

  it("redondea a 2 decimales", () => {
    expect(calcularInteresPeriodo(333.33, 10)).toBe(33.33);
  });

  it("da 0 cuando el saldo ya está en 0", () => {
    expect(calcularInteresPeriodo(0, 10)).toBe(0);
  });
});

describe("primeraCuotaInteresSolo / siguienteCuotaInteresSolo", () => {
  const startDate = new Date("2026-01-01T00:00:00Z");

  it("la primera cuota cobra interés sobre el capital inicial y vence un periodo después", () => {
    const primera = primeraCuotaInteresSolo({
      principal: 2000,
      interestRatePercentPerPeriod: 10,
      frequency: "MENSUAL",
      startDate,
    });

    expect(primera.number).toBe(1);
    expect(primera.amountDue).toBe(200);
    expect(primera.dueDate.toISOString()).toBe(new Date("2026-02-01T00:00:00Z").toISOString());
  });

  it("la siguiente cuota recalcula el interés sobre el nuevo saldo tras un abono a capital", () => {
    const primera = primeraCuotaInteresSolo({
      principal: 2000,
      interestRatePercentPerPeriod: 10,
      frequency: "MENSUAL",
      startDate,
    });

    // Cliente abona 500 a capital: el saldo baja a 1500
    const siguiente = siguienteCuotaInteresSolo({
      outstandingPrincipal: 1500,
      interestRatePercentPerPeriod: 10,
      frequency: "MENSUAL",
      prevDueDate: primera.dueDate,
      prevNumber: primera.number,
    });

    expect(siguiente.number).toBe(2);
    expect(siguiente.amountDue).toBe(150); // 10% de 1500, no de 2000
    expect(siguiente.dueDate.toISOString()).toBe(new Date("2026-03-01T00:00:00Z").toISOString());
  });

  it("si no se abona capital, el interés del siguiente periodo es igual al anterior", () => {
    const primera = primeraCuotaInteresSolo({
      principal: 2000,
      interestRatePercentPerPeriod: 10,
      frequency: "QUINCENAL",
      startDate,
    });

    const siguiente = siguienteCuotaInteresSolo({
      outstandingPrincipal: 2000, // no cambió: solo pagó interés
      interestRatePercentPerPeriod: 10,
      frequency: "QUINCENAL",
      prevDueDate: primera.dueDate,
      prevNumber: primera.number,
    });

    expect(siguiente.amountDue).toBe(primera.amountDue);
  });
});

describe("plazoPactadoVencido", () => {
  it("no está vencido antes de cumplirse el plazo", () => {
    const { vencido, fechaFinPactada } = plazoPactadoVencido({
      startDate: new Date("2026-01-01T00:00:00Z"),
      termMonths: 6,
      now: new Date("2026-05-01T00:00:00Z"),
    });
    expect(vencido).toBe(false);
    expect(fechaFinPactada.toISOString()).toBe(new Date("2026-07-01T00:00:00Z").toISOString());
  });

  it("está vencido después de cumplirse el plazo", () => {
    const { vencido } = plazoPactadoVencido({
      startDate: new Date("2026-01-01T00:00:00Z"),
      termMonths: 6,
      now: new Date("2026-08-01T00:00:00Z"),
    });
    expect(vencido).toBe(true);
  });
});
