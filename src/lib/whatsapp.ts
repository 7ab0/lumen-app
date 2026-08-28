import { formatCurrency, formatDate } from "@/lib/utils";

// Plantilla de mensaje editable con variables {nombre} {monto}
// {fecha_vencimiento} {dias_mora} (ver plan, sección "Botón rápido de
// WhatsApp"). Se puede llevar a configuración editable por el admin
// más adelante; por ahora vive acá como default del sistema.
export function buildWhatsAppMessage(row: {
  clientName: string;
  amountDue: number;
  dueDate: Date;
  daysLate: number;
}) {
  const nombre = row.clientName.split(" ")[0];
  const monto = formatCurrency(row.amountDue);
  const fecha = formatDate(row.dueDate);

  if (row.daysLate > 0) {
    return `Hola ${nombre}, te escribo de Lumen. Tienes una cuota de ${monto} vencida desde el ${fecha} (${row.daysLate} día(s) de atraso). ¿Podrías coordinar el pago hoy? Gracias.`;
  }
  if (row.daysLate === 0) {
    return `Hola ${nombre}, te recuerdo que hoy vence tu cuota de ${monto} con Lumen. ¡Gracias por tu puntualidad!`;
  }
  return `Hola ${nombre}, te recuerdo que tu cuota de ${monto} vence el ${fecha}. Cualquier consulta, escríbeme por aquí.`;
}

export function buildWhatsAppLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
