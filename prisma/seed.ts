import { PrismaClient, PaymentFrequency } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { buildInstallmentPlan } from "../src/lib/amortization";
import { recalcularScore } from "../src/lib/score";

// Datos de ejemplo para desarrollo local, en reemplazo del
// lumen-datos-ejemplo.xlsx original que se perdió junto con el código
// anterior (ver plan, "Próximos pasos"). Aproxima la misma forma:
// usuarios de staff, ~6 clientes, ~7 préstamos con sus cuotas, algunos
// pagos ya registrados (para tener mora e historial de score) y un par
// de mensajes de WhatsApp.

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando datos de ejemplo...");

  const passwordHash = await bcrypt.hash("lumen1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@lumen.pe" },
    update: {},
    create: {
      name: "Ana Rojas (Admin)",
      email: "admin@lumen.pe",
      passwordHash,
      role: "ADMIN",
    },
  });

  const cobrador = await prisma.user.upsert({
    where: { email: "cobrador@lumen.pe" },
    update: {},
    create: {
      name: "Luis Torres (Cobrador)",
      email: "cobrador@lumen.pe",
      passwordHash,
      role: "COBRADOR",
    },
  });

  const clientsData = [
    { firstName: "María", lastName: "Quispe", documentId: "45123456", phone: "51987001122" },
    { firstName: "Carlos", lastName: "Huamán", documentId: "45123457", phone: "51987001133" },
    { firstName: "Rosa", lastName: "Flores", documentId: "45123458", phone: "51987001144" },
    { firstName: "Jorge", lastName: "Mamani", documentId: "45123459", phone: "51987001155" },
    { firstName: "Elena", lastName: "Vargas", documentId: "45123460", phone: "51987001166" },
    { firstName: "Pedro", lastName: "Rivera", documentId: "45123461", phone: "51987001177" },
  ];

  const clients = [];
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { documentId: c.documentId },
      update: {},
      create: {
        ...c,
        address: "Av. Ejemplo 123, Lima",
        profileCompletedAt: new Date(),
        createdById: admin.id,
      },
    });
    clients.push(client);
  }

  // 7 préstamos repartidos entre los 6 clientes (uno tiene 2), con
  // fechas de inicio variadas para que algunas cuotas ya estén
  // atrasadas y otras próximas a vencer (para poder ver la agenda
  // diaria con datos realistas apenas se levanta el proyecto).
  const loanSeeds = [
    { client: clients[0], principal: 500, rate: 8, term: 3, freq: "MENSUAL" as const, startOffsetDays: -70 },
    { client: clients[1], principal: 800, rate: 6, term: 4, freq: "MENSUAL" as const, startOffsetDays: -40 },
    { client: clients[2], principal: 300, rate: 10, term: 6, freq: "SEMANAL" as const, startOffsetDays: -30 },
    { client: clients[3], principal: 1200, rate: 5, term: 6, freq: "MENSUAL" as const, startOffsetDays: -10 },
    { client: clients[4], principal: 400, rate: 8, term: 4, freq: "QUINCENAL" as const, startOffsetDays: -20 },
    { client: clients[5], principal: 600, rate: 7, term: 3, freq: "MENSUAL" as const, startOffsetDays: -5 },
    { client: clients[0], principal: 250, rate: 9, term: 4, freq: "SEMANAL" as const, startOffsetDays: -15 },
  ];

  let totalPayments = 0;

  for (const seed of loanSeeds) {
    const startDate = addDays(new Date(), seed.startOffsetDays);
    const plan = buildInstallmentPlan({
      principal: seed.principal,
      interestRatePercentPerPeriod: seed.rate,
      termMonths: seed.term,
      frequency: seed.freq,
      startDate,
    });

    const loan = await prisma.loan.create({
      data: {
        clientId: seed.client.id,
        principalAmount: seed.principal,
        interestRate: seed.rate,
        termMonths: seed.term,
        paymentFrequency: seed.freq as PaymentFrequency,
        startDate,
        assignedCollectorId: cobrador.id,
        createdById: admin.id,
        installments: {
          create: plan.map((item) => ({ number: item.number, dueDate: item.dueDate, amountDue: item.amountDue })),
        },
      },
      include: { installments: { orderBy: { number: "asc" } } },
    });

    // Marca como pagadas las cuotas ya vencidas (simulando que el
    // cliente pagó puntualmente la mayoría), y deja con cierta
    // probabilidad la última vencida sin pagar para poder ver la
    // agenda con mora real apenas se levanta el proyecto.
    const now = new Date();
    const overdue = loan.installments.filter((i) => i.dueDate < now);

    for (let idx = 0; idx < overdue.length; idx++) {
      const installment = overdue[idx];
      const isLastOverdue = idx === overdue.length - 1;
      if (isLastOverdue && overdue.length >= 1 && Math.random() < 0.4) {
        // Se deja pendiente/atrasada a propósito
        await prisma.installment.update({
          where: { id: installment.id },
          data: { status: "ATRASADA", wasLate: true },
        });
        await prisma.loan.update({ where: { id: loan.id }, data: { status: "EN_MORA" } });
        continue;
      }

      await prisma.payment.create({
        data: {
          installmentId: installment.id,
          loanId: loan.id,
          amount: installment.amountDue,
          paymentDate: subDays(installment.dueDate, Math.floor(Math.random() * 2)),
          method: "EFECTIVO",
          registeredById: cobrador.id,
        },
      });
      await prisma.installment.update({
        where: { id: installment.id },
        data: { amountPaid: installment.amountDue, status: "PAGADA" },
      });
      totalPayments++;
    }
  }

  for (const client of clients) {
    await recalcularScore(client.id);
  }

  await prisma.messageLog.create({
    data: {
      clientId: clients[0].id,
      channel: "WHATSAPP_LINK",
      messageContent: "Hola María, te recuerdo tu cuota pendiente con Lumen. ¡Gracias!",
      sentById: cobrador.id,
    },
  });

  console.log(`Listo: ${clients.length} clientes, ${loanSeeds.length} préstamos, ${totalPayments} pagos.`);
  console.log("Usuarios de prueba:");
  console.log("  admin@lumen.pe / lumen1234 (ADMIN)");
  console.log("  cobrador@lumen.pe / lumen1234 (COBRADOR)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
