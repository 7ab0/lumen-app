"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const schema = z.object({
  clientId: z.string(),
  installmentId: z.string().optional(),
  loanId: z.string().optional(),
  messageContent: z.string(),
});

// Registra en MessageLog cada vez que el cobrador confirma el envío del
// WhatsApp (el enlace wa.me ya se abrió en el navegador antes de esto).
export async function registrarEnvioWhatsapp(input: z.infer<typeof schema>) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const data = schema.parse(input);

  await prisma.messageLog.create({
    data: {
      clientId: data.clientId,
      installmentId: data.installmentId,
      loanId: data.loanId,
      channel: "WHATSAPP_LINK",
      messageContent: data.messageContent,
      sentById: session.user.id,
    },
  });

  if (data.installmentId) {
    await prisma.installment.update({
      where: { id: data.installmentId },
      data: { reminderSentAt: new Date() },
    });
  }

  return { ok: true };
}
