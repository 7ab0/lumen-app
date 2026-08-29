"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Subida real de documentos adjuntos (DNI, comprobantes, contratos) a
// Vercel Blob (ver plan, "Próximos pasos" — pendiente para completar el
// MVP). Requiere la variable de entorno BLOB_READ_WRITE_TOKEN (ver
// .env.example); sin ella, la subida falla con un mensaje claro en vez
// de romper silenciosamente.

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const subirAdjuntoSchema = z.object({
  relatedType: z.enum(["CLIENT", "LOAN", "PAYMENT"]),
  relatedId: z.string(),
  type: z.enum(["DNI", "COMPROBANTE_PAGO", "CONTRATO", "OTRO"]),
  clientId: z.string().optional(),
  loanId: z.string().optional(),
  paymentId: z.string().optional(),
});

export async function subirAdjunto(
  input: z.infer<typeof subirAdjuntoSchema> & { file: File }
) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");

  const { file, ...rest } = input;
  const data = subirAdjuntoSchema.parse(rest);

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona un archivo");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("El archivo no puede pesar más de 10 MB");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Formato no permitido. Usa una imagen (JPG/PNG/WEBP) o un PDF.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Falta configurar el almacenamiento de archivos (BLOB_READ_WRITE_TOKEN en .env) — ver README."
    );
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${data.relatedType.toLowerCase()}/${data.relatedId}/${data.type.toLowerCase()}-${Date.now()}.${extension}`;

  const blob = await put(key, file, { access: "public" });

  const attachment = await prisma.attachment.create({
    data: {
      relatedType: data.relatedType,
      relatedId: data.relatedId,
      clientId: data.clientId,
      loanId: data.loanId,
      paymentId: data.paymentId,
      fileUrl: blob.url,
      type: data.type,
      uploadedById: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      afterData: { relatedType: data.relatedType, relatedId: data.relatedId, type: data.type },
    },
  });

  if (data.clientId) revalidatePath(`/clientes/${data.clientId}`);
  if (data.loanId) revalidatePath(`/prestamos/${data.loanId}`);

  return { ok: true, url: blob.url };
}
