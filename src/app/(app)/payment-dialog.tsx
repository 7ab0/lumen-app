"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarPago, cancelarPrestamo } from "@/server/actions/payments";
import { formatCurrency } from "@/lib/utils";
import { queueOfflinePayment, isOnline } from "@/lib/offline-queue";

export function PaymentDialog({
  installmentId,
  clientName,
  saldoPendiente,
  loanType,
  outstandingPrincipal,
  onClose,
}: {
  installmentId: string;
  clientName: string;
  saldoPendiente: number;
  loanType?: "CUOTA_FIJA" | "INTERES_SOBRE_SALDO";
  outstandingPrincipal?: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(saldoPendiente.toFixed(2));
  const [method, setMethod] = useState<"EFECTIVO" | "TRANSFERENCIA" | "OTRO">("EFECTIVO");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const puedeCancelar = loanType === "INTERES_SOBRE_SALDO" && !!outstandingPrincipal;
  const montoCancelacion = puedeCancelar ? saldoPendiente + Number(outstandingPrincipal) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (cancelando) {
      try {
        if (!isOnline()) throw new Error("La cancelación total requiere conexión");
        const result = await cancelarPrestamo({ installmentId, method, notes: notes || undefined });
        if (!result.ok) throw new Error("No se pudo cancelar el préstamo");
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cancelar el préstamo");
      } finally {
        setLoading(false);
      }
      return;
    }

    const payload = {
      installmentId,
      amount: Number(amount),
      method,
      notes: notes || undefined,
    };

    try {
      if (!isOnline()) {
        await queueOfflinePayment(payload);
      } else {
        const result = await registrarPago(payload);
        if (!result.ok) throw new Error("No se pudo registrar el pago");
      }
      router.refresh();
      onClose();
    } catch (err) {
      // Si falla por conexión, igual lo guardamos en la cola offline
      // para no perder el registro del cobro.
      await queueOfflinePayment(payload);
      router.refresh();
      onClose();
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 md:rounded-2xl">
        <h2 className="text-base font-semibold text-slate-900">
          {cancelando ? "Cancelar préstamo" : "Registrar pago"}
        </h2>
        <p className="mb-4 text-sm text-slate-500">{clientName}</p>

        {puedeCancelar && (
          <div className="mb-4 flex rounded-lg border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setCancelando(false)}
              className={`flex-1 rounded-md py-1.5 ${!cancelando ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Pagar interés
            </button>
            <button
              type="button"
              onClick={() => setCancelando(true)}
              className={`flex-1 rounded-md py-1.5 ${cancelando ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Cancelar todo
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {cancelando ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>Capital pendiente: {formatCurrency(Number(outstandingPrincipal))}</p>
              <p>Interés de esta cuota: {formatCurrency(saldoPendiente)}</p>
              <p className="mt-1 font-semibold text-slate-900">
                Total a cobrar: {formatCurrency(montoCancelacion)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Monto (saldo: {formatCurrency(saldoPendiente)})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="method">Método</Label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Guardando..." : cancelando ? "Confirmar cancelación" : "Confirmar pago"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
