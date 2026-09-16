"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recalcularScore } from "@/lib/score";
import { generarSiguienteCuotaInteresSoloSiNoExiste } from "@/lib/interes-solo";

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

    // En INTERES_SOBRE_SALDO las cuotas son solo interés y no amortizan
    // capital: que todas estén pagadas no significa que el préstamo esté
    // saldado. Ese cierre solo ocurre vía cancelarPrestamo.
    if (installment.loan.loanType === "CUOTA_FIJA") {
      const pendientes = await tx.installment.count({
        where: { loanId: installment.loanId, status: { not: "PAGADA" } },
      });
      if (pendientes === 0) {
        await tx.loan.update({ where: { id: installment.loanId }, data: { status: "PAGADO" } });
      }
    } else if (isFullyPaid) {
      // Si se pagó más que el interés del periodo, el excedente es abono
      // a capital (ver plan, sección 2.0: "solo interés" vs. "abona
      // capital"). Si se pagó justo el interés, el capital no cambia.
      const interesDeCuota = Number(installment.amountDue);
      const abonoCapital = Math.max(0, Math.round((newAmountPaid - interesDeCuota) * 100) / 100);
      const capitalActual = Number(installment.loan.outstandingPrincipal ?? 0);
      const capitalNuevo = Math.round((capitalActual - abonoCapital) * 100) / 100;

      if (abonoCapital > 0) {
        await tx.loan.update({
          where: { id: installment.loanId },
          data: { outstandingPrincipal: capitalNuevo },
        });
      }

      // Si esta cuota estaba atrasada y ya no quedan otras cuotas
      // atrasadas, el préstamo vuelve a ACTIVO (ya no está en mora).
      if (installment.loan.status === "EN_MORA") {
        const otrasAtrasadas = await tx.installment.count({
          where: { loanId: installment.loanId, status: "ATRASADA", id: { not: installment.id } },
        });
        if (otrasAtrasadas === 0) {
          await tx.loan.update({ where: { id: installment.loanId }, data: { status: "ACTIVO" } });
        }
      }

      await generarSiguienteCuotaInteresSoloSiNoExiste(
        tx,
        installment.loan,
        installment,
        abonoCapital > 0 ? capitalNuevo : capitalActual
      );
    }
  });

  await recalcularScore(installment.loan.clientId);

  revalidatePath("/");
  revalidatePath(`/clientes/${installment.loan.clientId}`);
  revalidatePath(`/prestamos/${installment.loanId}`);

  return { ok: true, duplicate: false };
}

const cancelarPrestamoSchema = z.object({
  installmentId: z.string(),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "OTRO"]).default("EFECTIVO"),
  notes: z.string().optional(),
});

export type CancelarPrestamoInput = z.infer<typeof cancelarPrestamoSchema>;

// Cierre de un préstamo de INTERES_SOBRE_SALDO: el cliente paga de una
// vez el capital pendiente más el interés no pagado de la cuota actual,
// en lugar de seguir pagando solo interés mes a mes. Solo disponible en
// línea (no se ofrece en el flujo offline de la PWA).
export async function cancelarPrestamo(input: CancelarPrestamoInput) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const data = cancelarPrestamoSchema.parse(input);

  const installment = await prisma.installment.findUniqueOrThrow({
    where: { id: data.installmentId },
    include: { loan: true },
  });

  if (installment.loan.loanType !== "INTERES_SOBRE_SALDO") {
    throw new Error("La cancelación total solo aplica a préstamos de interés sobre saldo");
  }

  const outstandingPrincipal = Number(installment.loan.outstandingPrincipal ?? 0);
  const interesPendiente = Number(installment.amountDue) - Number(installment.amountPaid);
  const montoTotal = Math.round((outstandingPrincipal + interesPendiente) * 100) / 100;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        installmentId: installment.id,
        loanId: installment.loanId,
        amount: montoTotal,
        method: data.method,
        notes: data.notes ? `Cancelación total. ${data.notes}` : "Cancelación total",
        registeredById: session.user.id,
      },
    });

    await tx.installment.update({
      where: { id: installment.id },
      data: { amountPaid: installment.amountDue, status: "PAGADA" },
    });

    // Las cuotas de interés que aún no vencían dejan de tener sentido:
    // la cancelación total salda el capital y cierra el préstamo.
    await tx.installment.deleteMany({
      where: {
        loanId: installment.loanId,
        number: { gt: installment.number },
        status: { in: ["PENDIENTE", "ATRASADA"] },
      },
    });

    await tx.loan.update({
      where: { id: installment.loanId },
      data: { status: "PAGADO", outstandingPrincipal: 0 },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id,
        afterData: { installmentId: installment.id, amount: montoTotal, tipo: "cancelacion_total" },
      },
    });
  });

  await recalcularScore(installment.loan.clientId);

  revalidatePath("/");
  revalidatePath(`/clientes/${installment.loan.clientId}`);
  revalidatePath(`/prestamos/${installment.loanId}`);

  return { ok: true };
}
