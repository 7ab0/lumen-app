import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { addDays } from "date-fns";
import { DownloadReportButton } from "./download-report-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const activeLoans = await prisma.loan.findMany({
    where: { status: { in: ["ACTIVO", "EN_MORA"] } },
    include: { installments: true, client: true },
  });

  const carteraActiva = activeLoans.reduce((sum, loan) => {
    const pendiente = loan.installments
      .filter((i) => i.status !== "PAGADA")
      .reduce((s, i) => s + (Number(i.amountDue) - Number(i.amountPaid)), 0);
    return sum + pendiente;
  }, 0);

  const prestamosEnMora = activeLoans.filter((l) => l.status === "EN_MORA").length;
  const porcentajeMora =
    activeLoans.length > 0 ? Math.round((prestamosEnMora / activeLoans.length) * 100) : 0;

  const proximaSemana = addDays(new Date(), 7);
  const proximosVencimientos = await prisma.installment.findMany({
    where: {
      status: { in: ["PENDIENTE", "PARCIAL"] },
      dueDate: { lte: proximaSemana },
    },
    include: { loan: { include: { client: true } } },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Dashboard de cartera</h1>
        <DownloadReportButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Cartera activa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(carteraActiva)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">% en mora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{porcentajeMora}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Préstamos activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">{activeLoans.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Próximos vencimientos (7 días)
        </h2>
        <div className="flex flex-col gap-2">
          {proximosVencimientos.length === 0 && (
            <p className="text-sm text-slate-500">No hay vencimientos en los próximos 7 días.</p>
          )}
          {proximosVencimientos.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-center justify-between pt-4">
                <p className="text-sm font-medium text-slate-900">
                  {i.loan.client.firstName} {i.loan.client.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {formatCurrency(Number(i.amountDue))} · {formatDate(i.dueDate)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
