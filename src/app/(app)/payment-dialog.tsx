"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarPago } from "@/server/actions/payments";
import { formatCurrency } from "@/lib/utils";
import { queueOfflinePayment, isOnline } from "@/lib/offline-queue";

export function PaymentDialog({
  installmentId,
  clientName,
  saldoPendiente,
  onClose,
}: {
  installmentId: string;
  clientName: string;
  saldoPendiente: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(saldoPendiente.toFixed(2));
  const [method, setMethod] = useState<"EFECTIVO" | "TRANSFERENCIA" | "OTRO">("EFECTIVO");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
        <h2 className="text-base font-semibold text-slate-900">Registrar pago</h2>
        <p className="mb-4 text-sm text-slate-500">{clientName}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              {loading ? "Guardando..." : "Confirmar pago"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
