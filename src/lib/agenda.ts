import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, endOfDay, differenceInCalendarDays } from "date-fns";

export type AgendaRow = {
  installmentId: string;
  loanId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  score: "A" | "B" | "C" | "D";
  amountDue: number;
  amountPaid: number;
  dueDate: Date;
  status: "PENDIENTE" | "PAGADA" | "PARCIAL" | "ATRASADA";
  daysLate: number; // > 0 = atrasada, 0 = hoy, < 0 = recordatorio (próxima)
  bucket: "atrasada" | "hoy" | "recordatorio";
};

// Trae las cuotas que vencen hoy, las atrasadas de días anteriores
// (priorizadas por antigüedad de mora) y las que vencen en 1-2 días
// (recordatorio) — ver plan, sección "Agenda diaria de cobros".
export async function getAgenda({
  collectorId,
  forDate = new Date(),
}: {
  collectorId?: string;
  forDate?: Date;
}): Promise<AgendaRow[]> {
  const today = startOfDay(forDate);
  const reminderLimit = endOfDay(addDays(today, 2));

  const installments = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDIENTE", "PARCIAL", "ATRASADA"] },
      dueDate: { lte: reminderLimit },
      ...(collectorId ? { loan: { assignedCollectorId: collectorId } } : {}),
    },
    include: { loan: { include: { client: true } } },
    orderBy: { dueDate: "asc" },
  });

  const rows: AgendaRow[] = installments.map((i) => {
    const daysLate = differenceInCalendarDays(today, startOfDay(i.dueDate));
    const bucket = daysLate > 0 ? "atrasada" : daysLate === 0 ? "hoy" : "recordatorio";
    return {
      installmentId: i.id,
      loanId: i.loanId,
      clientId: i.loan.clientId,
      clientName: `${i.loan.client.firstName} ${i.loan.client.lastName}`,
      clientPhone: i.loan.client.phone,
      score: i.loan.client.score,
      amountDue: Number(i.amountDue),
      amountPaid: Number(i.amountPaid),
      dueDate: i.dueDate,
      status: i.status,
      daysLate,
      bucket,
    };
  });

  // Atrasadas más antiguas primero, luego hoy, luego recordatorios próximos
  rows.sort((a, b) => b.daysLate - a.daysLate);
  return rows;
}
