import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularScore } from "@/lib/score";

// Job diario de mora (ver plan, sección "Mora"): revisa cuotas vencidas
// con saldo pendiente, las pasa a ATRASADA y marca el préstamo como
// EN_MORA. Programado en producción vía Vercel Cron (ver vercel.json),
// protegido con CRON_SECRET.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = new Date();

  const overdue = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDIENTE", "PARCIAL"] },
      dueDate: { lt: today },
    },
    include: { loan: true },
  });

  const affectedClientIds = new Set<string>();
  const affectedLoanIds = new Set<string>();

  for (const installment of overdue) {
    await prisma.installment.update({
      where: { id: installment.id },
      data: { status: "ATRASADA", wasLate: true },
    });
    affectedLoanIds.add(installment.loanId);
    affectedClientIds.add(installment.loan.clientId);
  }

  for (const loanId of affectedLoanIds) {
    await prisma.loan.update({ where: { id: loanId }, data: { status: "EN_MORA" } });
  }

  for (const clientId of affectedClientIds) {
    await recalcularScore(clientId);
  }

  return NextResponse.json({
    ok: true,
    cuotasMarcadasAtrasadas: overdue.length,
    prestamosAfectados: affectedLoanIds.size,
  });
}
