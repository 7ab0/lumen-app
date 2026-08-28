import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const clients = await prisma.client.findMany({
    where: {
      ...(isAdmin ? {} : { loans: { some: { assignedCollectorId: session?.user?.id } } }),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { documentId: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
        <Link href="/clientes/nuevo">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </Link>
      </div>

      <form className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, DNI o teléfono"
          className="pl-9"
        />
      </form>

      <div className="flex flex-col gap-2">
        {clients.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No se encontraron clientes.
          </p>
        )}
        {clients.map((client) => (
          <Link key={client.id} href={`/clientes/${client.id}`}>
            <Card>
              <CardContent className="flex items-center justify-between pt-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {client.firstName} {client.lastName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {client.documentId} · {client.phone}
                  </p>
                  {!client.profileCompletedAt && (
                    <p className="mt-0.5 text-xs text-amber-600">Perfil incompleto</p>
                  )}
                </div>
                <ScoreBadge score={client.score} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
