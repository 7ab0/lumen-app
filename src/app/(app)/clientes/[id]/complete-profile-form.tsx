"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completarPerfilCliente } from "@/server/actions/clients";

export function CompleteProfileForm({
  clientId,
  referrers,
}: {
  clientId: string;
  referrers: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [declaredIncome, setDeclaredIncome] = useState("");
  const [referredById, setReferredById] = useState("");
  const [guarantorFullName, setGuarantorFullName] = useState("");
  const [guarantorDocumentId, setGuarantorDocumentId] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await completarPerfilCliente({
      clientId,
      address: address || undefined,
      declaredIncome: declaredIncome ? Number(declaredIncome) : undefined,
      referredById: referredById || undefined,
      guarantorFullName: guarantorFullName || undefined,
      guarantorDocumentId: guarantorDocumentId || undefined,
      guarantorPhone: guarantorPhone || undefined,
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="declaredIncome">Ingresos declarados (opcional)</Label>
        <Input
          id="declaredIncome"
          type="number"
          step="0.01"
          value={declaredIncome}
          onChange={(e) => setDeclaredIncome(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referredById">Referido por (opcional)</Label>
        <select
          id="referredById"
          value={referredById}
          onChange={(e) => setReferredById(e.target.value)}
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Ninguno</option>
          {referrers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.firstName} {r.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-sm font-medium text-slate-700">Aval (opcional)</p>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Nombre completo"
            value={guarantorFullName}
            onChange={(e) => setGuarantorFullName(e.target.value)}
          />
          <Input
            placeholder="DNI / documento"
            value={guarantorDocumentId}
            onChange={(e) => setGuarantorDocumentId(e.target.value)}
          />
          <Input
            placeholder="Teléfono"
            value={guarantorPhone}
            onChange={(e) => setGuarantorPhone(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Guardando..." : "Guardar perfil completo"}
      </Button>
    </form>
  );
}
