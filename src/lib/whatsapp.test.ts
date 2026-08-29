import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, buildWhatsAppMessage } from "./whatsapp";

// buildWhatsAppMessage elige una plantilla al azar entre varias variantes
// (ver whatsapp.ts), así que las pruebas no comparan un texto exacto:
// verifican que, sea cual sea la variante elegida, el mensaje siempre
// incluya el primer nombre y el monto formateado, y respete el caso
// (atrasada / vence hoy / recordatorio próximo) según daysLate.
describe("buildWhatsAppMessage", () => {
  const row = {
    clientName: "María Quispe",
    amountDue: 150,
    dueDate: new Date("2026-08-20T00:00:00Z"),
    daysLate: 0,
  };

  it("siempre usa el primer nombre del cliente, no el apellido", () => {
    for (let i = 0; i < 20; i++) {
      const message = buildWhatsAppMessage(row);
      expect(message).toContain("María");
      expect(message).not.toContain("Quispe");
    }
  });

  it("incluye el monto formateado en soles", () => {
    const message = buildWhatsAppMessage(row);
    expect(message).toMatch(/S\/\s?150/);
  });

  it("con días de atraso > 0, el mensaje menciona los días de atraso", () => {
    for (let i = 0; i < 20; i++) {
      const message = buildWhatsAppMessage({ ...row, daysLate: 3 });
      expect(message).toMatch(/3 días/);
    }
  });

  it("con 1 día de atraso usa singular ('día'), no '1 días'", () => {
    for (let i = 0; i < 20; i++) {
      const message = buildWhatsAppMessage({ ...row, daysLate: 1 });
      expect(message).toContain("1 día");
      expect(message).not.toContain("1 días");
    }
  });

  it("con daysLate === 0 (vence hoy) no habla de atraso", () => {
    for (let i = 0; i < 20; i++) {
      const message = buildWhatsAppMessage({ ...row, daysLate: 0 });
      expect(message.toLowerCase()).not.toContain("atraso");
      expect(message.toLowerCase()).not.toContain("vencid");
    }
  });

  it("con daysLate negativo (recordatorio próximo) menciona la fecha de vencimiento", () => {
    for (let i = 0; i < 20; i++) {
      const message = buildWhatsAppMessage({ ...row, daysLate: -2 });
      expect(message).toMatch(/20 ago\.? 2026/i);
    }
  });

  it("rota entre más de una variante (no siempre devuelve el mismo texto)", () => {
    const mensajes = new Set(Array.from({ length: 40 }, () => buildWhatsAppMessage(row)));
    expect(mensajes.size).toBeGreaterThan(1);
  });
});

describe("buildWhatsAppLink", () => {
  it("arma un enlace wa.me con solo dígitos del teléfono", () => {
    const link = buildWhatsAppLink("+51 987-001-122", "hola");
    expect(link).toBe("https://wa.me/51987001122?text=hola");
  });

  it("codifica el mensaje para usarlo en una URL", () => {
    const link = buildWhatsAppLink("51987001122", "Hola María, ¿cómo estás?");
    expect(link).toContain(encodeURIComponent("Hola María, ¿cómo estás?"));
  });
});
