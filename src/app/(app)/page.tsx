import { auth } from "@/lib/auth";
import { getAgenda } from "@/lib/agenda";
import { AgendaList } from "./agenda-list";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const rows = await getAgenda({
    collectorId: isAdmin ? undefined : session?.user?.id,
  });

  const atrasadas = rows.filter((r) => r.bucket === "atrasada");
  const hoy = rows.filter((r) => r.bucket === "hoy");
  const recordatorios = rows.filter((r) => r.bucket === "recordatorio");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Agenda de hoy</h1>
        <p className="text-sm text-slate-500">
          {rows.length === 0
            ? "No hay cobros pendientes para hoy. Buen trabajo."
            : `${atrasadas.length} atrasada(s), ${hoy.length} vence(n) hoy, ${recordatorios.length} próxima(s) a vencer.`}
        </p>
      </div>

      <AgendaList atrasadas={atrasadas} hoy={hoy} recordatorios={recordatorios} />
    </div>
  );
}
