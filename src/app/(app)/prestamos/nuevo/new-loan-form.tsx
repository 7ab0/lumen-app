"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { crearPrestamo } from "@/server/actions/loans";
import { buildInstallmentPlan } from "@/lib/amortization";
import { formatCurrency, formatDate } from "@/lib/utils";

type Client = { id: string; firstName: string; lastName: string; documentId: string };
type Collector = { id: string; name: string; role: "ADMIN" | "COBRADOR" };

export function NewLoanForm({
  clients,
  collectors,
  defaultClientId,
}: {
  clients: Client[];
  collectors: Collector[];
  defaultClientId?: string;
}) {
  const [clientId, setClientId] = useState(defaultClientId || "");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestRate, setInterestRate] = useState("5");
  const [termMonths, setTermMonths] = useState("3");
  const [paymentFrequency, setPaymentFrequency] = useState<"SEMANAL" | "QUINCENAL" | "MENSUAL">(
    "MENSUAL"
  );
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignedCollectorId, setAssignedCollectorId] = useState(collectors[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const principal = Number(principalAmount);
    if (!principal || principal <= 0) return null;
    try {
      return buildInstallmentPlan({
        principal,
        interestRatePercentPerPeriod: Number(interestRate) || 0,
        termMonths: Number(termMonths) || 1,
        frequency: paymentFrequency,
        startDate: new Date(startDate),
      });
    } catch {
      return null;
    }
  }, [principalAmount, interestRate, termMonths, paymentFrequency, startDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Selecciona un cliente");
      return;
    }
    setLoading(true);
    try {
      await crearPrestamo({
        clientId,
        principalAmount: Number(principalAmount),
        interestRate: Number(interestRate),
        termMonths: Number(termMonths),
        paymentFrequency,
        startDate: new Date(startDate),
        assignedCollectorId,
      });
    } catch (err) {
      if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
        setError(err.message);
        setLoading(false);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">Cliente</Label>
              <select
                id="clientId"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.documentId})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="principalAmount">Monto</Label>
                <Input
                  id="principalAmount"
                  type="number"
                  step="0.01"
                  required
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="interestRate">Interés % / periodo</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  required
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="termMonths">Plazo (meses)</Label>
                <Input
                  id="termMonths"
                  type="number"
                  min="1"
                  required
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paymentFrequency">Frecuencia</Label>
                <select
                  id="paymentFrequency"
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as typeof paymentFrequency)}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="MENSUAL">Mensual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assignedCollectorId">Cobrador asignado</Label>
                <select
                  id="assignedCollectorId"
                  required
                  value={assignedCollectorId}
                  onChange={(e) => setAssignedCollectorId(e.target.value)}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Creando..." : "Crear préstamo y generar cuotas"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Vista previa: {preview.length} cuota(s)
            </p>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm text-slate-600">
              {preview.map((item) => (
                <div key={item.number} className="flex justify-between border-b border-slate-100 py-1">
                  <span>
                    #{item.number} · {formatDate(item.dueDate)}
                  </span>
                  <span>{formatCurrency(item.amountDue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
