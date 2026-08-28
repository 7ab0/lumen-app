"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Alta rápida (paso 1): lo mínimo para no hacer esperar al cliente en
// campo. Ver plan, sección "Decisiones de la tercera ronda".
const altaRapidaSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellido requerido"),
  documentId: z.string().min(3, "DNI/documento requerido"),
  phone: z.string().min(6, "Teléfono requerido"),
});

export async function crearClienteRapido(input: z.infer<typeof altaRapidaSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const data = altaRapidaSchema.parse(input);

  const existing = await prisma.client.findUnique({ where: { documentId: data.documentId } });
  if (existing) {
    throw new Error("Ya existe un cliente registrado con ese documento.");
  }

  const client = await prisma.client.create({
    data: { ...data, createdById: session.user.id },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Client",
      entityId: client.id,
      afterData: data,
    },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${client.id}`);
}

// Completar perfil (paso 2): dirección, ingresos, referido, y
// opcionalmente un aval. Los campos son opcionales a propósito — el
// cliente ya es operativo desde el paso 1.
const completarPerfilSchema = z.object({
  clientId: z.string(),
  address: z.string().optional(),
  declaredIncome: z.coerce.number().optional(),
  referredById: z.string().optional(),
  guarantorFullName: z.string().optional(),
  guarantorDocumentId: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorAddress: z.string().optional(),
});

export async function completarPerfilCliente(input: z.infer<typeof completarPerfilSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  const data = completarPerfilSchema.parse(input);

  const before = await prisma.client.findUniqueOrThrow({ where: { id: data.clientId } });

  await prisma.client.update({
    where: { id: data.clientId },
    data: {
      address: data.address || undefined,
      declaredIncome: data.declaredIncome,
      referredById: data.referredById || undefined,
      profileCompletedAt: new Date(),
    },
  });

  if (data.guarantorFullName && data.guarantorDocumentId && data.guarantorPhone) {
    await prisma.guarantor.create({
      data: {
        clientId: data.clientId,
        fullName: data.guarantorFullName,
        documentId: data.guarantorDocumentId,
        phone: data.guarantorPhone,
        address: data.guarantorAddress,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Client",
      entityId: data.clientId,
      beforeData: { address: before.address, declaredIncome: before.declaredIncome },
      afterData: { address: data.address, declaredIncome: data.declaredIncome },
    },
  });

  revalidatePath(`/clientes/${data.clientId}`);
}
