import { addDays, addMonths } from "date-fns";

export type PaymentFrequency = "SEMANAL" | "QUINCENAL" | "MENSUAL";

export type InstallmentPlanItem = {
  number: number;
  dueDate: Date;
  amountDue: number;
};

// Genera la tabla de cuotas al crear un préstamo (ver plan, sección
// "Crear préstamo"). Usa interés simple/flat repartido en partes
// iguales — método fácil de explicar al cliente. La tasa de interés
// (interestRate) se interpreta como % por cada periodo de pago, no
// anual. Un método de amortización más sofisticado (francés, tasas
// configurables por producto) queda como mejora para una fase
// posterior, según lo conversado en el plan.
export function buildInstallmentPlan({
  principal,
  interestRatePercentPerPeriod,
  termMonths,
  frequency,
  startDate,
}: {
  principal: number;
  interestRatePercentPerPeriod: number;
  termMonths: number;
  frequency: PaymentFrequency;
  startDate: Date;
}): InstallmentPlanItem[] {
  const numberOfPeriods = getNumberOfPeriods(termMonths, frequency);

  const totalInterest = principal * (interestRatePercentPerPeriod / 100) * numberOfPeriods;
  const totalAmount = principal + totalInterest;

  const rawInstallment = totalAmount / numberOfPeriods;
  const rounded = Math.round(rawInstallment * 100) / 100;

  const items: InstallmentPlanItem[] = [];
  let cumulative = 0;

  for (let i = 1; i <= numberOfPeriods; i++) {
    const dueDate = nextDueDate(startDate, frequency, i);
    // La última cuota absorbe la diferencia de redondeo para que la
    // suma cuadre exactamente con totalAmount.
    const isLast = i === numberOfPeriods;
    const amountDue = isLast ? Math.round((totalAmount - cumulative) * 100) / 100 : rounded;
    cumulative += amountDue;
    items.push({ number: i, dueDate, amountDue });
  }

  return items;
}

// Genera la tabla de cuotas de un préstamo de interés sobre saldo (ver
// plan de tipos de préstamo): el capital no amortiza con estas cuotas,
// así que cada periodo cobra el mismo interés sobre el capital inicial.
// El capital se salda aparte, de una sola vez, al cancelar el préstamo
// (ver server/actions/payments.ts, cancelarPrestamo).
export function buildInterestOnlyPlan({
  principal,
  interestRatePercentPerPeriod,
  termMonths,
  frequency,
  startDate,
}: {
  principal: number;
  interestRatePercentPerPeriod: number;
  termMonths: number;
  frequency: PaymentFrequency;
  startDate: Date;
}): InstallmentPlanItem[] {
  const numberOfPeriods = getNumberOfPeriods(termMonths, frequency);
  const interestAmount = Math.round(principal * (interestRatePercentPerPeriod / 100) * 100) / 100;

  const items: InstallmentPlanItem[] = [];
  for (let i = 1; i <= numberOfPeriods; i++) {
    items.push({ number: i, dueDate: nextDueDate(startDate, frequency, i), amountDue: interestAmount });
  }

  return items;
}

function getNumberOfPeriods(termMonths: number, frequency: PaymentFrequency): number {
  const periodsPerMonth = frequency === "SEMANAL" ? 4 : frequency === "QUINCENAL" ? 2 : 1;
  return Math.max(1, Math.round(termMonths * periodsPerMonth));
}

function nextDueDate(startDate: Date, frequency: PaymentFrequency, periodNumber: number): Date {
  if (frequency === "SEMANAL") return addDays(startDate, periodNumber * 7);
  if (frequency === "QUINCENAL") return addDays(startDate, periodNumber * 15);
  return addMonths(startDate, periodNumber);
}

export function siguienteFechaPeriodo(base: Date, frequency: PaymentFrequency): Date {
  if (frequency === "SEMANAL") return addDays(base, 7);
  if (frequency === "QUINCENAL") return addDays(base, 15);
  return addMonths(base, 1);
}

export function calcularInteresPeriodo(outstandingPrincipal: number, interestRatePercentPerPeriod: number): number {
  return Math.round(outstandingPrincipal * (interestRatePercentPerPeriod / 100) * 100) / 100;
}

export type CuotaInteresSolo = {
  number: number;
  dueDate: Date;
  amountDue: number;
};

export function primeraCuotaInteresSolo({
  principal,
  interestRatePercentPerPeriod,
  frequency,
  startDate,
}: {
  principal: number;
  interestRatePercentPerPeriod: number;
  frequency: PaymentFrequency;
  startDate: Date;
}): CuotaInteresSolo {
  return {
    number: 1,
    dueDate: siguienteFechaPeriodo(startDate, frequency),
    amountDue: calcularInteresPeriodo(principal, interestRatePercentPerPeriod),
  };
}

export function siguienteCuotaInteresSolo({
  outstandingPrincipal,
  interestRatePercentPerPeriod,
  frequency,
  prevDueDate,
  prevNumber,
}: {
  outstandingPrincipal: number;
  interestRatePercentPerPeriod: number;
  frequency: PaymentFrequency;
  prevDueDate: Date;
  prevNumber: number;
}): CuotaInteresSolo {
  return {
    number: prevNumber + 1,
    dueDate: siguienteFechaPeriodo(prevDueDate, frequency),
    amountDue: calcularInteresPeriodo(outstandingPrincipal, interestRatePercentPerPeriod),
  };
}

export function plazoPactadoVencido({
  startDate,
  termMonths,
  now,
}: {
  startDate: Date;
  termMonths: number;
  now: Date;
}): { vencido: boolean; fechaFinPactada: Date } {
  const fechaFinPactada = addMonths(startDate, termMonths);
  return { vencido: now > fechaFinPactada, fechaFinPactada };
}
