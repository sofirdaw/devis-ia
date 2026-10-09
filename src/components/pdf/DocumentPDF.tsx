import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrencyPDF, formatDateNumeric } from "@/lib/utils";
import { amountInCfaWords, getDocumentSubject } from "@/lib/pdf-format";
import type { Company, Client } from "@/types";

export type PdfTemplate = "classic" | "modern" | "minimal";

export type PDFDocumentData = {
  type: "quote" | "invoice";
  number: string;
  status: string;
  date: string;
  dueOrValidDate: string | null;
  client: Client;
  company: Company;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
    total: number;
    description?: string;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  notes: string | null;
  template?: PdfTemplate;
  useHeader?: boolean;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 138,
    paddingBottom: 64,
    paddingHorizontal: 38,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#172033",
    backgroundColor: "#ffffff",
  },
  pageForPreprintedStationery: { paddingTop: 112, paddingBottom: 82 },
  header: {
    position: "absolute",
    top: 24,
    left: 38,
    right: 38,
    height: 92,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1e3a5f",
    paddingBottom: 10,
  },
  headerModern: { borderBottomColor: "#0f766e" },
  headerMinimal: { borderBottomColor: "#6b7280", borderBottomWidth: 0.8 },
  logoBox: {
    width: 88,
    height: 70,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingRight: 12,
    marginRight: 14,
    borderRightWidth: 0.8,
    borderRightColor: "#cbd5e1",
  },
  logo: { width: 72, height: 62, objectFit: "contain" },
  logoPlaceholder: {
    width: 55,
    height: 55,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 27.5,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: { fontSize: 16, fontWeight: "bold", color: "#1e3a5f" },
  companyBlock: { flex: 1 },
  servicesBlock: {
    width: 145,
    minHeight: 62,
    justifyContent: "center",
    paddingLeft: 10,
    marginLeft: 10,
    borderLeftWidth: 0.8,
    borderLeftColor: "#cbd5e1",
  },
  servicesLabel: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  servicesText: { fontSize: 7.2, color: "#334155", lineHeight: 1.35 },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.7,
    color: "#1e3a5f",
    marginBottom: 4,
  },
  companyNameModern: { color: "#0f766e" },
  companyNameMinimal: { color: "#111827", fontSize: 14 },
  companyTagline: { fontSize: 7, color: "#475569", marginBottom: 3 },
  companyContact: { fontSize: 7.5, color: "#334155", lineHeight: 1.4 },
  docHeading: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 12,
    paddingVertical: 7,
    borderTopWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: "#94a3b8",
  },
  docHeadingModern: { backgroundColor: "#f0fdfa", borderColor: "#99f6e4" },
  docHeadingMinimal: { borderColor: "#d1d5db" },
  docTitle: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1.1,
    color: "#1e3a5f",
    textAlign: "center",
  },
  docTitleModern: { color: "#0f766e" },
  docTitleMinimal: { color: "#111827" },
  metaLine: { fontSize: 8, color: "#334155", marginTop: 3, textAlign: "center" },
  recipientBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 74,
    borderWidth: 0.8,
    borderColor: "#64748b",
    marginBottom: 12,
  },
  recipientBoxModern: { borderColor: "#0f766e" },
  recipientBoxMinimal: { borderColor: "#d1d5db" },
  recipientBlock: { width: "56%", padding: 9, justifyContent: "center" },
  recipientBlockWithoutCompanyDetails: { width: "100%" },
  recipientHeading: { fontSize: 7.2, fontWeight: "bold", color: "#475569", marginBottom: 4 },
  clientName: { fontSize: 10, fontWeight: "bold", color: "#111827", marginBottom: 2 },
  clientLine: { fontSize: 7.5, lineHeight: 1.3, color: "#334155" },
  companyIds: {
    width: "44%",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: 0.8,
    borderLeftColor: "#94a3b8",
  },
  idLine: { fontSize: 7.4, lineHeight: 1.5, color: "#1f2937" },
  subjectRow: { flexDirection: "row", marginBottom: 8, paddingVertical: 3 },
  subjectLabel: { fontSize: 8.5, fontWeight: "bold", marginRight: 5, color: "#111827" },
  subjectText: { flex: 1, fontSize: 8.5, color: "#1f2937" },
  table: { borderWidth: 1, borderColor: "#374151", marginBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e8edf3", minHeight: 26 },
  tableHeaderModern: { backgroundColor: "#ccfbf1" },
  tableHeaderMinimal: { backgroundColor: "#f8fafc" },
  headerCell: {
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderRightColor: "#64748b",
    fontSize: 7.4,
    fontWeight: "bold",
    color: "#111827",
  },
  row: { flexDirection: "row", minHeight: 27, borderTopWidth: 0.55, borderTopColor: "#94a3b8" },
  rowAlternate: { backgroundColor: "#f8fafc" },
  cell: {
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRightWidth: 0.55,
    borderRightColor: "#94a3b8",
    fontSize: 7.6,
    color: "#1f2937",
  },
  numberColumn: { width: "7%", textAlign: "center" },
  designationColumn: { width: "43%" },
  quantityColumn: { width: "13%", textAlign: "center" },
  unitPriceColumn: { width: "18%", textAlign: "right" },
  totalColumn: { width: "19%", textAlign: "right", borderRightWidth: 0 },
  itemDescription: { fontSize: 6.8, color: "#64748b", marginTop: 2 },
  totals: { width: "57%", marginLeft: "43%", marginBottom: 8 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cbd5e1",
  },
  totalLabel: { fontSize: 8, color: "#334155" },
  totalValue: { fontSize: 8, color: "#111827", textAlign: "right" },
  grandTotal: { backgroundColor: "#e8edf3", borderBottomWidth: 0 },
  grandTotalModern: { backgroundColor: "#ccfbf1" },
  grandTotalMinimal: { backgroundColor: "#f8fafc" },
  grandTotalText: { fontSize: 9.2, fontWeight: "bold", color: "#111827" },
  amountWords: {
    borderWidth: 0.7,
    borderColor: "#94a3b8",
    padding: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  amountWordsLabel: { fontSize: 7.2, fontWeight: "bold", color: "#475569", marginBottom: 3 },
  amountWordsText: { fontSize: 8.2, fontWeight: "bold", color: "#111827" },
  notes: { fontSize: 7.5, color: "#475569", marginTop: 4, lineHeight: 1.4 },
  closing: { marginTop: 10, fontSize: 8.5, fontWeight: "bold", color: "#111827" },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
    minHeight: 72,
  },
  signatureBlock: { width: "42%", alignItems: "center", justifyContent: "flex-start" },
  signatureTitle: { fontSize: 8, fontWeight: "bold", color: "#111827", marginBottom: 6 },
  signatureHint: { fontSize: 7, color: "#64748b" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 38,
    right: 38,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    fontSize: 6.8,
    textAlign: "center",
    color: "#64748b",
  },
});

function CompanyHeader({ company, template }: { company: Company; template: PdfTemplate }) {
  const companyNameStyle = [
    styles.companyName,
    template === "modern" ? styles.companyNameModern : {},
    template === "minimal" ? styles.companyNameMinimal : {},
  ];
  const contactLines = [company.address, company.phone, company.email].filter(Boolean);
  const headerStyle = [
    styles.header,
    template === "modern" ? styles.headerModern : {},
    template === "minimal" ? styles.headerMinimal : {},
  ];

  return (
    <View style={headerStyle} fixed>
      <View style={styles.logoBox}>
        {company.logo_url ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={company.logo_url} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>
              {company.name.trim().slice(0, 1).toUpperCase() || "E"}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.companyBlock}>
        <Text style={companyNameStyle}>{company.name}</Text>
        {contactLines.map((line, index) => (
          <Text key={`contact-${index}`} style={styles.companyContact}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.servicesBlock}>
        {company.service_description && (
          <>
            <Text style={styles.servicesLabel}>ACTIVITÉS / SERVICES</Text>
            <Text style={styles.servicesText}>{company.service_description}</Text>
          </>
        )}
      </View>
    </View>
  );
}

export function DocumentPDF({ data }: { data: PDFDocumentData }) {
  const isQuote = data.type === "quote";
  const template = data.template ?? "classic";
  const useHeader = data.useHeader ?? true;
  const title = isQuote ? "DEVIS" : data.status === "paid" ? "FACTURE ACQUITTÉE" : "FACTURE";
  const accentStyles =
    template === "modern"
      ? styles.docHeadingModern
      : template === "minimal"
        ? styles.docHeadingMinimal
        : {};
  const boxStyles = [
    styles.recipientBox,
    template === "modern" ? styles.recipientBoxModern : {},
    template === "minimal" ? styles.recipientBoxMinimal : {},
  ];
  const tableHeaderStyles = [
    styles.tableHeader,
    template === "modern" ? styles.tableHeaderModern : {},
    template === "minimal" ? styles.tableHeaderMinimal : {},
  ];
  const totalStyles = [
    styles.grandTotal,
    template === "modern" ? styles.grandTotalModern : {},
    template === "minimal" ? styles.grandTotalMinimal : {},
  ];
  const grandTotalStyles = [styles.totalRow, ...totalStyles];
  const designations = data.items.map((item) => item.designation);
  const identifierLines = [
    companyIdLine("RCCM", data.company.rccm),
    companyIdLine("IFU", data.company.ifu),
    companyIdLine("CME / Régime fiscal", data.company.cme),
  ].filter((line): line is string => Boolean(line));
  const dueDateLabel = isQuote ? "Valable jusqu'au" : "Échéance";
  const closingText = isQuote
    ? "Arrêté le présent devis à la somme de :"
    : "Arrêté la présente facture à la somme de :";

  return (
    <Document>
      <Page size="A4" style={[styles.page, !useHeader ? styles.pageForPreprintedStationery : {}]}>
        {useHeader && <CompanyHeader company={data.company} template={template} />}

        <View style={[styles.docHeading, accentStyles]}>
          <Text
            style={[
              styles.docTitle,
              template === "modern" ? styles.docTitleModern : {},
              template === "minimal" ? styles.docTitleMinimal : {},
            ]}
          >
            {title} N° {data.number}
          </Text>
          <Text style={styles.metaLine}>
            {useHeader && data.company.address ? `${data.company.address} — ` : ""}Le{" "}
            {formatDateNumeric(data.date)}
            {data.dueOrValidDate
              ? ` — ${dueDateLabel} ${formatDateNumeric(data.dueOrValidDate)}`
              : ""}
          </Text>
        </View>

        <View style={boxStyles}>
          <View
            style={[
              styles.recipientBlock,
              !useHeader ? styles.recipientBlockWithoutCompanyDetails : {},
            ]}
          >
            <Text style={styles.recipientHeading}>DOIT / CLIENT</Text>
            <Text style={styles.clientName}>{data.client.name}</Text>
            {data.client.address && <Text style={styles.clientLine}>{data.client.address}</Text>}
            {data.client.phone && <Text style={styles.clientLine}>Tél. : {data.client.phone}</Text>}
            {data.client.email && <Text style={styles.clientLine}>{data.client.email}</Text>}
            {(data.client.ifu || data.client.code) && (
              <Text style={styles.clientLine}>
                Identifiant : {data.client.ifu || data.client.code}
              </Text>
            )}
          </View>
          {useHeader && (
            <View style={styles.companyIds}>
              {identifierLines.length > 0 ? (
                identifierLines.map((line) => (
                  <Text key={line} style={styles.idLine}>
                    {line}
                  </Text>
                ))
              ) : (
                <Text style={styles.idLine}>{data.company.name}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.subjectRow}>
          <Text style={styles.subjectLabel}>Objet :</Text>
          <Text style={styles.subjectText}>{getDocumentSubject(designations)}</Text>
        </View>

        <View style={styles.table}>
          <View style={tableHeaderStyles} fixed>
            <Text style={[styles.headerCell, styles.numberColumn]}>N°</Text>
            <Text style={[styles.headerCell, styles.designationColumn]}>Désignation</Text>
            <Text style={[styles.headerCell, styles.quantityColumn]}>Quantité</Text>
            <Text style={[styles.headerCell, styles.unitPriceColumn]}>Prix unitaire</Text>
            <Text style={[styles.headerCell, styles.totalColumn]}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View
              key={`${item.designation}-${index}`}
              style={[
                styles.row,
                template === "modern" && index % 2 === 1 ? styles.rowAlternate : {},
              ]}
              wrap={false}
            >
              <Text style={[styles.cell, styles.numberColumn]}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={[styles.cell, styles.designationColumn]}>
                <Text>{item.designation}</Text>
                {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
              </View>
              <Text style={[styles.cell, styles.quantityColumn]}>{item.quantity}</Text>
              <Text style={[styles.cell, styles.unitPriceColumn]}>
                {formatCurrencyPDF(item.unit_price)}
              </Text>
              <Text style={[styles.cell, styles.totalColumn]}>{formatCurrencyPDF(item.total)}</Text>
            </View>
          ))}
          <View style={[styles.row, { backgroundColor: "#f1f5f9" }]} wrap={false}>
            <Text style={[styles.cell, styles.numberColumn]} />
            <Text style={[styles.cell, styles.designationColumn, { fontWeight: "bold" }]}>
              Montant total hors taxes
            </Text>
            <Text style={[styles.cell, styles.quantityColumn]} />
            <Text style={[styles.cell, styles.unitPriceColumn]} />
            <Text style={[styles.cell, styles.totalColumn, { fontWeight: "bold" }]}>
              {formatCurrencyPDF(data.subtotal)}
            </Text>
          </View>
        </View>

        <View style={styles.totals}>
          {data.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remise</Text>
              <Text style={styles.totalValue}>-{formatCurrencyPDF(data.discount)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({data.taxRate || 0} %)</Text>
            <Text style={styles.totalValue}>{formatCurrencyPDF(data.tax)}</Text>
          </View>
          <View style={grandTotalStyles}>
            <Text style={styles.grandTotalText}>Montant total TTC</Text>
            <Text style={styles.grandTotalText}>{formatCurrencyPDF(data.total)}</Text>
          </View>
        </View>

        <View style={styles.amountWords}>
          <Text style={styles.amountWordsLabel}>{closingText}</Text>
          <Text style={styles.amountWordsText}>{amountInCfaWords(data.total)}</Text>
        </View>

        {data.notes && <Text style={styles.notes}>Notes / conditions : {data.notes}</Text>}

        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>Le Gérant</Text>
            <Text style={styles.signatureHint}>Signature et cachet</Text>
          </View>
        </View>

        {useHeader && (
          <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
              `${data.company.name}${data.company.phone ? ` • ${data.company.phone}` : ""}${data.company.email ? ` • ${data.company.email}` : ""}  |  ${pageNumber} / ${totalPages}`
            }
          />
        )}
      </Page>
    </Document>
  );
}

function companyIdLine(label: string, value: string | null | undefined): string | null {
  return value ? `${label} : ${value}` : null;
}
