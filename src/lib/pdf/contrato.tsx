import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/utils";

// Contrato de préstamo descargable (ver plan, "Próximos pasos" y
// server/actions/loans.ts: "la generación del contrato en PDF
// descargable queda como siguiente iteración sobre este scaffold").
//
// Es una PLANTILLA de trabajo, no un documento legal validado: el
// aviso al final del contrato y el punto 8 del plan ("revisión de
// cumplimiento normativo") dejan esto explícito a propósito.

const FREQUENCY_LABEL: Record<string, string> = {
  SEMANAL: "semanal",
  QUINCENAL: "quincenal",
  MENSUAL: "mensual",
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 9, color: "#64748b", marginBottom: 20, textAlign: "center" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#334155",
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#64748b" },
  value: { fontWeight: "bold" },
  paragraph: { marginBottom: 8, lineHeight: 1.5, textAlign: "justify" },
  disclaimer: { marginTop: 16, fontSize: 8, color: "#94a3b8", lineHeight: 1.4 },
  table: { marginTop: 6, borderWidth: 1, borderColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableHeaderCell: { flex: 1, padding: 4, fontWeight: "bold", backgroundColor: "#f1f5f9" },
  tableCell: { flex: 1, padding: 4 },
  signatures: { marginTop: 48, flexDirection: "row", justifyContent: "space-between" },
  signatureBox: {
    width: "40%",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 4,
    textAlign: "center",
  },
  signatureRole: { color: "#94a3b8" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "center",
  },
});

type ContratoProps = {
  loan: {
    id: string;
    type: "INTERES_SOLO" | "CUOTA_FIJA";
    principalAmount: number;
    interestRate: number;
    termMonths: number;
    paymentFrequency: "SEMANAL" | "QUINCENAL" | "MENSUAL";
    startDate: Date;
    client: {
      firstName: string;
      lastName: string;
      documentId: string;
      address: string | null;
      phone: string;
    };
    assignedCollector: { name: string };
    installments: { number: number; dueDate: Date; amountDue: number }[];
  };
};

export function ContratoPrestamo({ loan }: ContratoProps) {
  const clientName = `${loan.client.firstName} ${loan.client.lastName}`;
  const frecuencia = FREQUENCY_LABEL[loan.paymentFrequency];
  const esInteresSolo = loan.type === "INTERES_SOLO";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Contrato de préstamo</Text>
        <Text style={styles.subtitle}>Lumen — Financiera personal</Text>

        <Text style={styles.sectionTitle}>Partes</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Cliente</Text>
          <Text style={styles.value}>{clientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>DNI / documento</Text>
          <Text style={styles.value}>{loan.client.documentId}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Dirección</Text>
          <Text style={styles.value}>{loan.client.address || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>{loan.client.phone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Asesor / cobrador</Text>
          <Text style={styles.value}>{loan.assignedCollector.name}</Text>
        </View>

        <Text style={styles.sectionTitle}>Condiciones del préstamo</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Monto del capital</Text>
          <Text style={styles.value}>{formatCurrency(loan.principalAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tasa de interés</Text>
          <Text style={styles.value}>
            {loan.interestRate}% por periodo ({frecuencia})
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Modalidad</Text>
          <Text style={styles.value}>{esInteresSolo ? "Interés sobre saldo" : "Cuota fija"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha de inicio</Text>
          <Text style={styles.value}>{formatDate(loan.startDate)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Plazo pactado</Text>
          <Text style={styles.value}>{loan.termMonths} mes(es)</Text>
        </View>

        <Text style={styles.sectionTitle}>Mecánica de pago</Text>
        {esInteresSolo ? (
          <Text style={styles.paragraph}>
            EL CLIENTE recibe de LUMEN la suma de {formatCurrency(loan.principalAmount)}, sobre la
            cual pagará un interés de {loan.interestRate}% por cada periodo {frecuencia}, calculado
            sobre el capital pendiente. En cada fecha de pago, EL CLIENTE podrá: (a) pagar solo el
            interés del periodo, manteniendo el capital vigente para el siguiente periodo; (b) abonar
            una parte adicional al capital, reduciendo el interés de los periodos siguientes; o (c)
            cancelar la totalidad del capital pendiente más el interés del periodo, dando por
            concluido este contrato. El plazo de {loan.termMonths} mes(es) es referencial: al
            cumplirse, ambas partes podrán acordar continuar bajo los mismos términos o proceder a la
            cancelación.
          </Text>
        ) : (
          <Text style={styles.paragraph}>
            EL CLIENTE recibe de LUMEN la suma de {formatCurrency(loan.principalAmount)}, que
            devolverá junto con el interés pactado en {loan.installments.length} cuota(s) de
            periodicidad {frecuencia}, según el detalle a continuación. El incumplimiento en la fecha
            pactada de cualquier cuota podrá generar los recargos por mora que LUMEN comunique
            oportunamente a EL CLIENTE.
          </Text>
        )}

        {!esInteresSolo && loan.installments.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeaderCell}>Cuota</Text>
              <Text style={styles.tableHeaderCell}>Vencimiento</Text>
              <Text style={styles.tableHeaderCell}>Monto</Text>
            </View>
            {loan.installments.map((i) => (
              <View style={styles.tableRow} key={i.number}>
                <Text style={styles.tableCell}>#{i.number}</Text>
                <Text style={styles.tableCell}>{formatDate(i.dueDate)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(i.amountDue)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>
          Documento generado automáticamente por el sistema de Lumen a partir de los datos
          registrados, el {formatDate(new Date())}. Es una plantilla base de trabajo: antes de usarla
          formalmente con clientes debe ser revisada y validada por un abogado, conforme a la
          normativa aplicable (protección de datos personales, topes de tasa de interés, y demás
          regulación vigente).
        </Text>

        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <Text>{clientName}</Text>
            <Text style={styles.signatureRole}>EL CLIENTE</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>{loan.assignedCollector.name}</Text>
            <Text style={styles.signatureRole}>POR LUMEN</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages} · Préstamo ${loan.id}`}
          fixed
        />
      </Page>
    </Document>
  );
}
