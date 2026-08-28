"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildInstallmentPlan } from "@/lib/amortization";

const crearPrestamoSchema = z.object({
  clientId: z.string(),
  principalAmount: z.coerce.number().positive(),
  interestRate: z.coerce.number().min(0),
  termMonths: z.coerce.number().int().positive(),
  paymentFrequency: z.enum(["SEMANAL", "QUINCENAL", "MENSUAL"]),
  startDate: z.coerce.date(),
  assignedCollectorId: z.string(),
});

// Al crear el préstamo se genera automáticamente la tabla de cuotas
// (ver plan, sección "Crear préstamo"). La generación del contrato en
// PDF descargable queda como siguiente iteración sobre este scaffold.
export async function crearPrestamo(input: z.infer<typeof crearPrestamoSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const data = crearPrestamoSchema.parse(input);

  const plan = buildInstallmentPlan({
    principal: data.principalAmount,
    interestRatePercentPerPeriod: data.interestRate,
    termMonths: data.termMonths,
    frequency: data.paymentFrequency,
    startDate: data.startDate,
  });

  const loan = await prisma.loan.create({
    data: {
      clientId: data.clientId,
      principalAmount: data.principalAmount,
      interestRate: data.interestRate,
      termMonths: data.termMonths,
      paymentFrequency: data.paymentFrequency,
      startDate: data.startDate,
      assignedCollectorId: data.assignedCollectorId,
      createdById: session.user.id,
      installments: {
        create: plan.map((item) => ({
          number: item.number,
          dueDate: item.dueDate,
          amountDue: item.amountDue,
        })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Loan",
      entityId: loan.id,
      afterData: { clientId: data.clientId, principalAmount: data.principalAmount },
    },
  });

  revalidatePath("/prestamos");
  revalidatePath(`/clientes/${data.clientId}`);
  redirect(`/prestamos/${loan.id}`);
}
