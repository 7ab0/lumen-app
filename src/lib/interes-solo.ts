import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { siguienteCuotaInteresSolo, type PaymentFrequency } from "@/lib/amortization";

type Db = typeof prisma | Prisma.TransactionClient;

type LoanParaSiguienteCuota = {
  id: string;
  interestRate: Prisma.Decimal | number;
  paymentFrequency: PaymentFrequency;
};

type CuotaActual = {
  number: number;
  dueDate: Date;
};

// Genera la cuota del siguiente periodo para un préstamo INTERES_SOBRE_SALDO
// cuando la cuota actual se resuelve (se paga o el job de mora la marca
// ATRASADA) — ver plan, sección 2.0 y "Próximos pasos" punto 9.
// Idempotente: si la cuota siguiente ya existe (por ejemplo, generada antes
// por el job de mora), no hace nada — evita duplicados.
export async function generarSiguienteCuotaInteresSoloSiNoExiste(
  db: Db,
  loan: LoanParaSiguienteCuota,
  cuotaActual: CuotaActual,
  outstandingPrincipal: number
) {
  const yaExiste = await db.installment.findUnique({
    where: { loanId_number: { loanId: loan.id, number: cuotaActual.number + 1 } },
  });
  if (yaExiste) return;

  const siguiente = siguienteCuotaInteresSolo({
    outstandingPrincipal,
    interestRatePercentPerPeriod: Number(loan.interestRate),
    frequency: loan.paymentFrequency,
    prevDueDate: cuotaActual.dueDate,
    prevNumber: cuotaActual.number,
  });

  await db.installment.create({
    data: {
      loanId: loan.id,
      number: siguiente.number,
      dueDate: siguiente.dueDate,
      amountDue: siguiente.amountDue,
    },
  });
}
