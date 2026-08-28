import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CompleteProfileForm } from "./complete-profile-form";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      guarantors: true,
      referredBy: true,
      loans: { include: { installments: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) notFound();

  const possibleReferrers = await prisma.client.findMany({
    where: { id: { not: client.id } },
    select: { id: true, firstName: true, lastName: true },
    take: 100,
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {client.documentId} · {client.phone}
          </p>
        </div>
        <ScoreBadge score={client.score} />
      </div>

      {!client.profileCompletedAt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Completar perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <CompleteProfileForm clientId={client.id} referrers={possibleReferrers} />
          </CardContent>
        </Card>
      )}

      {client.profileCompletedAt && (
        <Card>
          <CardHeader>
            <CardTitle>Datos adicionales</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-slate-600">
            <p>Dirección: {client.address || "—"}</p>
            <p>
              Ingresos declarados:{" "}
              {client.declaredIncome ? formatCurrency(Number(client.declaredIncome)) : "—"}
            </p>
            <p>Referido por: {client.referredBy ? `${client.referredBy.firstName} ${client.referredBy.lastName}` : "—"}</p>
            {client.guarantors.length > 0 && (
              <p>
                Aval: {client.guarantors[0].fullName} ({client.guarantors[0].documentId})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Préstamos</h2>
        <Link href={`/prestamos/nuevo?clientId=${client.id}`}>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nuevo préstamo
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {client.loans.length === 0 && (
          <p className="text-sm text-slate-500">Este cliente todavía no tiene préstamos.</p>
        )}
        {client.loans.map((loan) => {
          const pendientes = loan.installments.filter((i) => i.status !== "PAGADA").length;
          return (
            <Link key={loan.id} href={`/prestamos/${loan.id}`}>
              <Card>
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatCurrency(Number(loan.principalAmount))}
                    </p>
                    <p className="text-sm text-slate-500">
                      Desde {formatDate(loan.startDate)} · {pendientes} cuota(s) pendiente(s)
                    </p>
                  </div>
                  <span className="text-xs font-medium uppercase text-slate-500">
                    {loan.status.replace("_", " ")}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
