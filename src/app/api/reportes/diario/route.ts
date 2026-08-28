import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Reporte diario descargable (ver plan, sección "Reporte diario
// descargable"): tres hojas — Cobros del día, Pendientes/atrasados del
// día, y Mensajes enviados.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const collectorFilter = isAdmin ? {} : { registeredById: session.user.id };
  const loanCollectorFilter = isAdmin ? {} : { assignedCollectorId: session.user.id };

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [payments, pendientesHoy, messages] = await Promise.all([
    prisma.payment.findMany({
      where: { paymentDate: { gte: dayStart, lte: dayEnd }, ...collectorFilter },
      include: { installment: { include: { loan: { include: { client: true } } } } },
    }),
    prisma.installment.findMany({
      where: {
        status: { in: ["PENDIENTE", "PARCIAL", "ATRASADA"] },
        dueDate: { lte: dayEnd },
        loan: loanCollectorFilter,
      },
      include: { loan: { include: { client: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.messageLog.findMany({
      where: { sentAt: { gte: dayStart, lte: dayEnd }, ...(isAdmin ? {} : { sentById: session.user.id }) },
      include: { client: true },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lumen";
  workbook.created = today;

  const cobrosSheet = workbook.addWorksheet("Cobros del día");
  cobrosSheet.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Método", key: "metodo", width: 16 },
    { header: "Hora", key: "hora", width: 12 },
  ];
  payments.forEach((p) => {
    cobrosSheet.addRow({
      cliente: `${p.installment.loan.client.firstName} ${p.installment.loan.client.lastName}`,
      monto: Number(p.amount),
      metodo: p.method,
      hora: p.paymentDate.toLocaleTimeString("es-PE"),
    });
  });

  const pendientesSheet = workbook.addWorksheet("Pendientes y atrasados");
  pendientesSheet.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Teléfono", key: "telefono", width: 16 },
    { header: "Saldo", key: "saldo", width: 14 },
    { header: "Vencimiento", key: "vencimiento", width: 14 },
    { header: "Estado", key: "estado", width: 14 },
  ];
  pendientesHoy.forEach((i) => {
    pendientesSheet.addRow({
      cliente: `${i.loan.client.firstName} ${i.loan.client.lastName}`,
      telefono: i.loan.client.phone,
      saldo: Number(i.amountDue) - Number(i.amountPaid),
      vencimiento: i.dueDate.toLocaleDateString("es-PE"),
      estado: i.status,
    });
  });

  const mensajesSheet = workbook.addWorksheet("Mensajes enviados");
  mensajesSheet.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Mensaje", key: "mensaje", width: 60 },
    { header: "Hora", key: "hora", width: 12 },
  ];
  messages.forEach((m) => {
    mensajesSheet.addRow({
      cliente: `${m.client.firstName} ${m.client.lastName}`,
      mensaje: m.messageContent,
      hora: m.sentAt.toLocaleTimeString("es-PE"),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `lumen-reporte-${today.toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
