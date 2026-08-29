import { formatCurrency, formatDate } from "@/lib/utils";

// Plantillas de mensaje editables con variables {nombre} {monto}
// {fecha_vencimiento} {dias_mora} (ver plan, sección "Botón rápido de
// WhatsApp"). Se puede llevar a configuración editable por el admin
// más adelante; por ahora viven acá como default del sistema.
//
// Primer borrador con tono cálido y cariñoso, firmado como "Lummen"
// (la cobradora) — pendiente de que el negocio las revise y ajuste
// (28 de agosto de 2026, ver plan "Próximos pasos"). Hay varias
// variantes por caso para que no se sienta repetitivo escribiéndole
// siempre lo mismo al mismo cliente; se elige una al azar cada vez.

const MENSAJES_ATRASADA = [
  (nombre: string, monto: string, fecha: string, dias: number) =>
    `Hola ${nombre}, ¿cómo estás? Te escribe Lummen. Quería avisarte con cariño que tu cuota de ${monto} venció el ${fecha} (${dias} día${dias === 1 ? "" : "s"} de atraso). Sé que a veces se complica, así que cualquier cosa aquí estoy para coordinar el pago hoy. Un abrazo.`,
  (nombre: string, monto: string, fecha: string, dias: number) =>
    `${nombre}, corazón, espero que estés muy bien. Tu cuota de ${monto} quedó pendiente desde el ${fecha} (${dias} día${dias === 1 ? "" : "s"}). Confío en que podemos ponernos al día hoy mismo — gracias por tu confianza de siempre. Con cariño, Lummen.`,
  (nombre: string, monto: string, fecha: string, dias: number) =>
    `Hola ${nombre}, un gusto saludarte. Te recuerdo con todo el cariño que tu cuota de ${monto} está vencida desde el ${fecha} (${dias} día${dias === 1 ? "" : "s"} de atraso). Sabemos que cumples, así que contamos contigo para hoy. – Lummen`,
];

const MENSAJES_VENCE_HOY = [
  (nombre: string, monto: string) =>
    `Hola ${nombre}, ¡lindo día! Hoy es el día de tu cuota de ${monto}. Gracias por ser tan puntual, de verdad se aprecia muchísimo. Un abrazo, Lummen.`,
  (nombre: string, monto: string) =>
    `${nombre}, cielo, hoy vence tu cuota de ${monto}. Sabemos que siempre cumples y eso nos alegra el día. ¡Gracias por confiar en nosotros! – Lummen`,
  (nombre: string, monto: string) =>
    `Hola ${nombre}, pasando a recordarte con cariño que hoy toca tu cuota de ${monto}. Tu puntualidad es un gran ejemplo. Gracias por eso, de corazón.`,
];

const MENSAJES_PROXIMO = [
  (nombre: string, monto: string, fecha: string) =>
    `Hola ${nombre}, espero que tengas un lindo día. Te aviso con tiempo y cariño: tu cuota de ${monto} vence el ${fecha}. Cualquier duda, aquí estoy para ti. – Lummen`,
  (nombre: string, monto: string, fecha: string) =>
    `${nombre}, querido/a, te escribo para recordarte que el ${fecha} vence tu cuota de ${monto}. Gracias por caminar junto a nosotros en esto. ¡Que tengas un excelente día!`,
  (nombre: string, monto: string, fecha: string) =>
    `Hola ${nombre}, un gusto saludarte. Te cuento con cariño que tu cuota de ${monto} vence el ${fecha}. Estoy aquí para lo que necesites. Con cariño, Lummen.`,
];

function elegirAlAzar<T>(opciones: T[]): T {
  return opciones[Math.floor(Math.random() * opciones.length)];
}

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
    return elegirAlAzar(MENSAJES_ATRASADA)(nombre, monto, fecha, row.daysLate);
  }
  if (row.daysLate === 0) {
    return elegirAlAzar(MENSAJES_VENCE_HOY)(nombre, monto);
  }
  return elegirAlAzar(MENSAJES_PROXIMO)(nombre, monto, fecha);
}

export function buildWhatsAppLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
