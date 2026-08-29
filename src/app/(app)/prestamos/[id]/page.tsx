import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { plazoPactadoVencido } from "@/lib/amortization";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { DownloadContractButton } from "./download-contract-button";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  PENDIENTE: "default",
  PAGADA: "success",
  PARCIAL: "info",
  ATRASADA: "danger",
} as const;

const TIPO_LABEL: Record<string, string> = {
  INTERES_SOLO: "Interés sobre saldo",
  CUOTA_FIJA: "Cuota fija",
};

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
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!loan) notFound();

  const esInteresSolo = loan.type === "INTERES_SOLO";
  const totalDue = loan.installments.reduce((sum, i) => sum + Number(i.amountDue), 0);
  const totalPaid = loan.installments.reduce((sum, i) => sum + Number(i.amountPaid), 0);
  const { vencido: plazoVencido, fechaFinPactada } = plazoPactadoVencido({
    startDate: loan.startDate,
    termMonths: loan.termMonths,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/clientes/${loan.clientId}`} className="text-sm text-emerald-700 hover:underline">
          {loan.client.firstName} {loan.client.lastName}
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{formatCurrency(Number(loan.principalAmount))}</h1>
          <Badge variant="default">{TIPO_LABEL[loan.type]}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          Cobrador: {loan.assignedCollector.name} · Inicio: {formatDate(loan.startDate)}
        </p>
        <div className="mt-2">
          <DownloadContractButton loanId={loan.id} />
        </div>
      </div>

      {esInteresSolo && plazoVencido && loan.status !== "PAGADO" && loan.status !== "CANCELADO" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-800">
            Este préstamo superó el plazo pactado ({formatDate(fechaFinPactada)}) y sigue con capital
            pendiente. Se decide caso por caso (ver plan): puedes conversar con el cliente para cerrar o
            seguir cobrando solo interés.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-4 text-sm">
          {esInteresSolo ? (
            <>
              <div>
                <p className="text-slate-500">Capital pendiente</p>
                <p className="font-semibold text-slate-900">
                  {formatCurrency(Number(loan.outstandingPrincipal))}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Interés cobrado hasta hoy</p>
                <p className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-slate-500">Total a pagar</p>
                <p className="font-semibold text-slate-900">{formatCurrency(totalDue)}</p>
              </div>
              <div>
                <p className="text-slate-500">Pagado</p>
                <p className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {esInteresSolo ? "Cuotas de interés" : "Cuotas"}
        </h2>
        {loan.installments.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex items-center justify-between pt-4">
              <div>
                <p className="font-medium text-slate-900">
                  {esInteresSolo ? `Periodo #${i.number}` : `Cuota #${i.number}`} · {formatDate(i.dueDate)}
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

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentsPanel
            relatedType="LOAN"
            relatedId={loan.id}
            loanId={loan.id}
            availableTypes={["CONTRATO", "COMPROBANTE_PAGO", "OTRO"]}
            attachments={loan.attachments.map((a) => ({
              id: a.id,
              type: a.type,
              fileUrl: a.fileUrl,
              uploadedAt: a.uploadedAt,
              uploadedByName: a.uploadedBy.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
