import { PrismaClient, PaymentFrequency } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import {
  buildInstallmentPlan,
  primeraCuotaInteresSolo,
  siguienteCuotaInteresSolo,
} from "../src/lib/amortization";
import { recalcularScore } from "../src/lib/score";

// Datos de ejemplo para desarrollo local, en reemplazo del
// lumen-datos-ejemplo.xlsx original que se perdió junto con el código
// anterior (ver plan, "Próximos pasos"). Aproxima la misma forma:
// usuarios de staff, ~6 clientes, ~7 préstamos con sus cuotas, algunos
// pagos ya registrados (para tener mora e historial de score) y un par
// de mensajes de WhatsApp.
//
// Incluye los dos tipos de préstamo (ver plan, sección "2.0 Mecánica de
// repago según tipo de préstamo"): la mayoría INTERES_SOLO (el más
// usado en la práctica) y un par CUOTA_FIJA (el método clásico).

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando datos de ejemplo...");

  // A diferencia de los usuarios y clientes (upsert por email/documentId),
  // los préstamos no tienen una clave de negocio natural para upsert, así
  // que cada corrida los recrea desde cero: borra todo lo ligado a
  // préstamos antes de sembrar, para que "npx prisma db seed" sea
  // idempotente y no vaya acumulando préstamos duplicados en cada corrida.
  await prisma.payment.deleteMany({});
  await prisma.messageLog.deleteMany({ where: { loanId: { not: null } } });
  await prisma.attachment.deleteMany({ where: { loanId: { not: null } } });
  await prisma.installment.deleteMany({});
  await prisma.loan.deleteMany({});

  const passwordHash = await bcrypt.hash("lumen1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@lumen.pe" },
    update: { name: "Sayda Priscila (Admin)", passwordHash, role: "ADMIN" },
    create: {
      name: "Sayda Priscila (Admin)",
      email: "admin@lumen.pe",
      passwordHash,
      role: "ADMIN",
    },
  });

  // "Lummen" es la cobradora del negocio (nombre elegido el 29 de
  // agosto de 2026, en línea con el tono cálido de las plantillas de
  // WhatsApp en src/lib/whatsapp.ts — pendiente de revisión del texto
  // exacto más adelante, ver plan).
  const cobrador = await prisma.user.upsert({
    where: { email: "lummen@lumen.pe" },
    update: { name: "Lummen (Cobradora)", passwordHash, role: "COBRADOR" },
    create: {
      name: "Lummen (Cobradora)",
      email: "lummen@lumen.pe",
      passwordHash,
      role: "COBRADOR",
    },
  });

  // Usuario de soporte (Gustavo, 29 de agosto de 2026). El esquema solo
  // tiene dos roles (ver schema.prisma, enum Role: ADMIN | COBRADOR) —
  // no existe un rol "soporte" separado, así que "todos los
  // privilegios" se traduce al rol con más permisos del sistema: ADMIN
  // (ve y gestiona todo, incluye el dashboard y el log de auditoría).
  await prisma.user.upsert({
    where: { email: "soporte@lumen.pe" },
    update: { name: "Gustavo (Soporte)", passwordHash, role: "ADMIN" },
    create: {
      name: "Gustavo (Soporte)",
      email: "soporte@lumen.pe",
      passwordHash,
      role: "ADMIN",
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

  let totalPayments = 0;

  // -------------------------------------------------------------------
  // Préstamos INTERES_SOLO: se simulan periodo a periodo, igual que lo
  // haría la app real (una cuota de interés a la vez; la siguiente se
  // genera recién cuando la anterior se resuelve), para que los datos
  // de ejemplo queden 100% consistentes con la lógica de negocio.
  // -------------------------------------------------------------------
  type Decision = "INTERES" | "ATRASADA" | "CANCELACION_TOTAL" | `ABONO:${number}`;

  async function seedInteresSolo({
    clientId,
    principal,
    rate,
    frequency,
    startDate,
    termMonths,
    decisiones,
  }: {
    clientId: string;
    principal: number;
    rate: number;
    frequency: PaymentFrequency;
    startDate: Date;
    termMonths: number;
    decisiones: Decision[];
  }) {
    const loan = await prisma.loan.create({
      data: {
        clientId,
        loanType: "INTERES_SOBRE_SALDO",
        principalAmount: principal,
        outstandingPrincipal: principal,
        interestRate: rate,
        termMonths,
        paymentFrequency: frequency,
        startDate,
        assignedCollectorId: cobrador.id,
        createdById: admin.id,
      },
    });

    let outstanding = principal;
    const primera = primeraCuotaInteresSolo({
      principal,
      interestRatePercentPerPeriod: rate,
      frequency,
      startDate,
    });
    let installment = await prisma.installment.create({
      data: {
        loanId: loan.id,
        number: primera.number,
        dueDate: primera.dueDate,
        amountDue: primera.amountDue,
      },
    });

    for (const decision of decisiones) {
      if (decision === "CANCELACION_TOTAL") {
        const interestAmount = Number(installment.amountDue);
        const principalAmount = outstanding;
        await prisma.payment.create({
          data: {
            installmentId: installment.id,
            loanId: loan.id,
            amount: interestAmount + principalAmount,
            paymentDate: installment.dueDate,
            method: "EFECTIVO",
            registeredById: cobrador.id,
          },
        });
        await prisma.installment.update({
          where: { id: installment.id },
          data: { amountPaid: interestAmount, status: "PAGADA" },
        });
        await prisma.loan.update({
          where: { id: loan.id },
          data: { outstandingPrincipal: 0, status: "PAGADO" },
        });
        totalPayments++;
        return; // préstamo cerrado, no se genera más
      }

      if (decision === "ATRASADA") {
        await prisma.installment.update({
          where: { id: installment.id },
          data: { status: "ATRASADA", wasLate: true },
        });
        await prisma.loan.update({ where: { id: loan.id }, data: { status: "EN_MORA" } });
      } else {
        const principalAmount = decision.startsWith("ABONO:") ? Number(decision.split(":")[1]) : 0;
        outstanding -= principalAmount;
        const interestAmount = Number(installment.amountDue);
        await prisma.payment.create({
          data: {
            installmentId: installment.id,
            loanId: loan.id,
            amount: interestAmount + principalAmount,
            paymentDate: installment.dueDate,
            method: "EFECTIVO",
            registeredById: cobrador.id,
          },
        });
        await prisma.installment.update({
          where: { id: installment.id },
          data: { amountPaid: interestAmount, status: "PAGADA" },
        });
        await prisma.loan.update({
          where: { id: loan.id },
          data: { outstandingPrincipal: outstanding, status: "ACTIVO" },
        });
        totalPayments++;
      }

      // Genera la cuota del siguiente periodo (igual que payments.ts /
      // api/jobs/mora al resolver un periodo).
      const siguiente = siguienteCuotaInteresSolo({
        outstandingPrincipal: outstanding,
        interestRatePercentPerPeriod: rate,
        frequency,
        prevDueDate: installment.dueDate,
        prevNumber: installment.number,
      });
      installment = await prisma.installment.create({
        data: {
          loanId: loan.id,
          number: siguiente.number,
          dueDate: siguiente.dueDate,
          amountDue: siguiente.amountDue,
        },
      });
    }
  }

  // María: préstamo pagado por completo (interés dos veces y luego
  // cancela todo) — historia de éxito.
  await seedInteresSolo({
    clientId: clients[0].id,
    principal: 500,
    rate: 10,
    frequency: "MENSUAL",
    startDate: addDays(new Date(), -95),
    termMonths: 3,
    decisiones: ["INTERES", "INTERES", "CANCELACION_TOTAL"],
  });

  // Carlos: pagó el primer mes de interés, dejó de pagar el segundo
  // (queda en mora, capital intacto) — la siguiente cuota ya está
  // generada y pendiente.
  await seedInteresSolo({
    clientId: clients[1].id,
    principal: 800,
    rate: 10,
    frequency: "MENSUAL",
    startDate: addDays(new Date(), -70),
    termMonths: 4,
    decisiones: ["INTERES", "ATRASADA"],
  });

  // Rosa: paga interés, luego abona parte del capital, luego interés de
  // nuevo — muestra cómo baja el interés del periodo siguiente.
  await seedInteresSolo({
    clientId: clients[2].id,
    principal: 300,
    rate: 10,
    frequency: "SEMANAL",
    startDate: addDays(new Date(), -35),
    termMonths: 6,
    decisiones: ["INTERES", "ABONO:50", "INTERES"],
  });

  // Elena: recién pagó el primer periodo, la segunda cuota está por
  // vencer (para verse en la agenda como recordatorio o del día).
  await seedInteresSolo({
    clientId: clients[4].id,
    principal: 400,
    rate: 10,
    frequency: "QUINCENAL",
    startDate: addDays(new Date(), -40),
    termMonths: 4,
    decisiones: ["INTERES"],
  });

  // María: segundo préstamo, más chico, también con un periodo
  // atrasado.
  await seedInteresSolo({
    clientId: clients[0].id,
    principal: 250,
    rate: 10,
    frequency: "SEMANAL",
    startDate: addDays(new Date(), -20),
    termMonths: 4,
    decisiones: ["INTERES", "ATRASADA"],
  });

  // -------------------------------------------------------------------
  // Préstamos CUOTA_FIJA: método clásico, tabla de cuotas generada de
  // una sola vez al crear el préstamo (sin cambios respecto al
  // comportamiento original).
  // -------------------------------------------------------------------
  const cuotaFijaSeeds = [
    { client: clients[3], principal: 1200, rate: 5, term: 6, freq: "MENSUAL" as const, startOffsetDays: -10 },
    { client: clients[5], principal: 600, rate: 7, term: 3, freq: "MENSUAL" as const, startOffsetDays: -5 },
  ];

  for (const seed of cuotaFijaSeeds) {
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
        loanType: "CUOTA_FIJA",
        principalAmount: seed.principal,
        outstandingPrincipal: seed.principal,
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

  console.log(`Listo: ${clients.length} clientes, 7 préstamos (5 interés-solo, 2 cuota fija), ${totalPayments} pagos.`);
  console.log("Usuarios de prueba:");
  console.log("  admin@lumen.pe / lumen1234 (ADMIN)");
  console.log("  lummen@lumen.pe / lumen1234 (COBRADOR)");
  console.log("  soporte@lumen.pe / lumen1234 (ADMIN — Gustavo, soporte)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
