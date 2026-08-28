"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recalcularScore } from "@/lib/score";

const registrarPagoSchema = z.object({
  installmentId: z.string(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "OTRO"]).default("EFECTIVO"),
  notes: z.string().optional(),
  // Presente cuando el pago se registró sin conexión desde la PWA y
  // recién ahora se sincroniza (ver plan, sección "PWA y modo offline").
  offlineClientId: z.string().optional(),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

export async function registrarPago(input: RegistrarPagoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const data = registrarPagoSchema.parse(input);

  const installment = await prisma.installment.findUniqueOrThrow({
    where: { id: data.installmentId },
    include: { loan: true },
  });

  // Evita duplicar un pago offline que ya se sincronizó antes (p. ej. si
  // el cobrador reenvía la cola offline dos veces).
  if (data.offlineClientId) {
    const existing = await prisma.payment.findFirst({
      where: { offlineClientId: data.offlineClientId },
    });
    if (existing) return { ok: true, duplicate: true };
  }

  const newAmountPaid = Number(installment.amountPaid) + data.amount;
  const isFullyPaid = newAmountPaid >= Number(installment.amountDue);

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        installmentId: installment.id,
        loanId: installment.loanId,
        amount: data.amount,
        method: data.method,
        notes: data.notes,
        registeredById: session.user.id,
        syncedFromOffline: !!data.offlineClientId,
        offlineClientId: data.offlineClientId,
      },
    });

    await tx.installment.update({
      where: { id: installment.id },
      data: {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? "PAGADA" : "PARCIAL",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id,
        afterData: {
          installmentId: installment.id,
          amount: data.amount,
          method: data.method,
        },
      },
    });

    const pendientes = await tx.installment.count({
      where: { loanId: installment.loanId, status: { not: "PAGADA" } },
    });
    if (pendientes === 0) {
      await tx.loan.update({ where: { id: installment.loanId }, data: { status: "PAGADO" } });
    }
  });

  await recalcularScore(installment.loan.clientId);

  revalidatePath("/");
  revalidatePath(`/clientes/${installment.loan.clientId}`);
  revalidatePath(`/prestamos/${installment.loanId}`);

  return { ok: true, duplicate: false };
}
