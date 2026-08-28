import { prisma } from "@/lib/prisma";

// Fórmula simple basada en puntualidad de pago (ver plan, sección
// "Calificación (score) de clientes"). Ajustable cuando la empresa
// defina sus propios criterios.
export async function recalcularScore(clientId: string) {
  const installments = await prisma.installment.findMany({
    where: { loan: { clientId } },
    select: { status: true, wasLate: true },
  });

  const decided = installments.filter((i) => i.status === "PAGADA" || i.status === "ATRASADA");
  const hasActiveMora = installments.some((i) => i.status === "ATRASADA");

  let onTimePercent = 100;
  if (decided.length > 0) {
    const onTime = decided.filter((i) => i.status === "PAGADA" && !i.wasLate).length;
    onTimePercent = (onTime / decided.length) * 100;
  }

  let score: "A" | "B" | "C" | "D";
  if (hasActiveMora) {
    // Mora activa siempre baja el score a C o D según antigüedad no se
    // calcula aquí a nivel de días (se hace en el job de mora); por
    // defecto una mora activa cualquiera baja al menos a C.
    score = onTimePercent < 60 ? "D" : "C";
  } else if (onTimePercent >= 95) {
    score = "A";
  } else if (onTimePercent >= 80) {
    score = "B";
  } else if (onTimePercent >= 60) {
    score = "C";
  } else {
    score = "D";
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { score, scoreUpdatedAt: new Date() },
  });

  return score;
}
