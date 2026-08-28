import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  PENDIENTE: "default",
  PAGADA: "success",
  PARCIAL: "info",
  ATRASADA: "danger",
} as const;

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      client: true,
      assignedCollector: true,
      installments: { orderBy: { number: "asc" } },
    },
  });

  if (!loan) notFound();

  const totalDue = loan.installments.reduce((sum, i) => sum + Number(i.amountDue), 0);
  const totalPaid = loan.installments.reduce((sum, i) => sum + Number(i.amountPaid), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/clientes/${loan.clientId}`} className="text-sm text-emerald-700 hover:underline">
          {loan.client.firstName} {loan.client.lastName}
        </Link>
        <h1 className="text-xl font-bold text-slate-900">{formatCurrency(Number(loan.principalAmount))}</h1>
        <p className="text-sm text-slate-500">
          Cobrador: {loan.assignedCollector.name} · Inicio: {formatDate(loan.startDate)}
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 text-sm">
          <div>
            <p className="text-slate-500">Total a pagar</p>
            <p className="font-semibold text-slate-900">{formatCurrency(totalDue)}</p>
          </div>
          <div>
            <p className="text-slate-500">Pagado</p>
            <p className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cuotas</h2>
        {loan.installments.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-slate-900">
                  Cuota #{i.number} · {formatDate(i.dueDate)}
                </p>
                <p className="text-sm text-slate-500">
                  {formatCurrency(Number(i.amountPaid))} / {formatCurrency(Number(i.amountDue))}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[i.status]}>{i.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
