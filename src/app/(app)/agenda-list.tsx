"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { registrarEnvioWhatsapp } from "@/server/actions/messages";
import { PaymentDialog } from "./payment-dialog";
import type { AgendaRow } from "@/lib/agenda";
import { MessageCircle, CheckCircle2 } from "lucide-react";

function AgendaRowCard({ row }: { row: AgendaRow }) {
  const [showPayment, setShowPayment] = useState(false);
  const saldoPendiente = row.amountDue - row.amountPaid;

  function handleWhatsApp() {
    const message = buildWhatsAppMessage(row);
    window.open(buildWhatsAppLink(row.clientPhone, message), "_blank", "noopener,noreferrer");
    registrarEnvioWhatsapp({
      clientId: row.clientId,
      installmentId: row.installmentId,
      loanId: row.loanId,
      messageContent: message,
    }).catch(() => {
      // Si falla el registro (p. ej. sin señal), no bloqueamos el envío:
      // el mensaje ya se abrió en WhatsApp.
    });
  }

  return (
    <>
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-slate-900">{row.clientName}</p>
              <ScoreBadge score={row.score} />
            </div>
            <p className="text-sm text-slate-500">
              {formatCurrency(saldoPendiente)}
              {row.bucket === "atrasada" && (
                <span className="ml-1 text-red-600">· {row.daysLate}d de atraso</span>
              )}
              {row.bucket === "recordatorio" && (
                <span className="ml-1 text-amber-600">
                  · vence en {Math.abs(row.daysLate)}d
                </span>
              )}
              {row.bucket === "hoy" && <span className="ml-1 text-emerald-600">· vence hoy</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="whatsapp" size="icon" onClick={handleWhatsApp} aria-label="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={() => setShowPayment(true)} aria-label="Marcar como pagado">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPayment && (
        <PaymentDialog
          installmentId={row.installmentId}
          clientName={row.clientName}
          saldoPendiente={saldoPendiente}
          loanType={row.loanType}
          outstandingPrincipal={row.outstandingPrincipal}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}

function Section({ title, rows }: { title: string; rows: AgendaRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <AgendaRowCard key={row.installmentId} row={row} />
        ))}
      </div>
    </div>
  );
}

export function AgendaList({
  atrasadas,
  hoy,
  recordatorios,
}: {
  atrasadas: AgendaRow[];
  hoy: AgendaRow[];
  recordatorios: AgendaRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Atrasadas" rows={atrasadas} />
      <Section title="Vencen hoy" rows={hoy} />
      <Section title="Recordatorio (vencen pronto)" rows={recordatorios} />
    </div>
  );
}
