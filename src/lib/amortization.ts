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
  const periodsPerMonth = frequency === "SEMANAL" ? 4 : frequency === "QUINCENAL" ? 2 : 1;
  const numberOfPeriods = Math.max(1, Math.round(termMonths * periodsPerMonth));

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

function nextDueDate(startDate: Date, frequency: PaymentFrequency, periodNumber: number): Date {
  if (frequency === "SEMANAL") return addDays(startDate, periodNumber * 7);
  if (frequency === "QUINCENAL") return addDays(startDate, periodNumber * 15);
  return addMonths(startDate, periodNumber);
}
