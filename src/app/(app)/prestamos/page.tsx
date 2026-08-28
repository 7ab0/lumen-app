import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  PAGADO: "Pagado",
  EN_MORA: "En mora",
  CANCELADO: "Cancelado",
  REFINANCIADO: "Refinanciado",
};

export default async function PrestamosPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const loans = await prisma.loan.findMany({
    where: isAdmin ? {} : { assignedCollectorId: session?.user?.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Préstamos</h1>
        <Link href="/prestamos/nuevo">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {loans.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Todavía no hay préstamos.</p>
        )}
        {loans.map((loan) => (
          <Link key={loan.id} href={`/prestamos/${loan.id}`}>
            <Card>
              <CardContent className="flex items-center justify-between pt-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {loan.client.firstName} {loan.client.lastName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(Number(loan.principalAmount))} · desde {formatDate(loan.startDate)}
                  </p>
                </div>
                <span
                  className={
                    loan.status === "EN_MORA"
                      ? "text-xs font-semibold uppercase text-red-600"
                      : "text-xs font-semibold uppercase text-slate-500"
                  }
                >
                  {STATUS_LABEL[loan.status]}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
