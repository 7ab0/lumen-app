import { prisma } from "@/lib/prisma";
import { NewLoanForm } from "./new-loan-form";

export const dynamic = "force-dynamic";

export default async function NuevoPrestamoPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  const [clients, collectors] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, firstName: true, lastName: true, documentId: true },
      orderBy: { firstName: "asc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-bold text-slate-900">Nuevo préstamo</h1>
      <NewLoanForm clients={clients} collectors={collectors} defaultClientId={clientId} />
    </div>
  );
}
