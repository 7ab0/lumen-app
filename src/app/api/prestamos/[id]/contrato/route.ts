import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ContratoPrestamo } from "@/lib/pdf/contrato";

// Contrato de préstamo en PDF descargable (ver plan, "Próximos pasos").
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      client: true,
      assignedCollector: true,
      installments: { orderBy: { number: "asc" } },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    ContratoPrestamo({
      loan: {
        id: loan.id,
        loanType: loan.loanType,
        principalAmount: Number(loan.principalAmount),
        interestRate: Number(loan.interestRate),
        termMonths: loan.termMonths,
        paymentFrequency: loan.paymentFrequency,
        startDate: loan.startDate,
        client: {
          firstName: loan.client.firstName,
          lastName: loan.client.lastName,
          documentId: loan.client.documentId,
          address: loan.client.address,
          phone: loan.client.phone,
        },
        assignedCollector: { name: loan.assignedCollector.name },
        installments: loan.installments.map((i) => ({
          number: i.number,
          dueDate: i.dueDate,
          amountDue: Number(i.amountDue),
        })),
      },
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${loan.id}.pdf"`,
    },
  });
}
