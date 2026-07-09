/**
 * DocumentPDF — Template PDF partagé pour devis ET factures
 *
 * Utilise @react-pdf/renderer pour générer un PDF professionnel.
 * Un seul template pour les deux types de documents (devis/facture)
 * car leur structure visuelle est identique — seul le "type" change.
 *
 * ⚠️ Ce composant n'est PAS un composant React classique : il est rendu
 * par le moteur PDF (pas le DOM), donc pas de Tailwind ici — uniquement
 * le système StyleSheet.create() de react-pdf.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { formatCurrencyPDF, formatDate } from "@/lib/utils";
import type { Company, Client } from "@/types";

// ── Type générique englobant devis et facture ─────────────────────────────────
export type PDFDocumentData = {
  type: "quote" | "invoice";
  number: string; // quote_number ou invoice_number
  status: string;
  date: string; // created_at
  dueOrValidDate: string | null; // valid_until ou due_date
  client: Client;
  company: Company;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  notes: string | null;
};

// ── Styles (équivalent CSS pour react-pdf) ─────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  // En-tête : logo + infos entreprise à gauche, titre document à droite
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  companyBlock: {
    maxWidth: 280,
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 8,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 1,
  },
  docTitleBlock: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#2563eb",
    marginBottom: 4,
  },
  docNumber: {
    fontSize: 11,
    color: "#374151",
    marginBottom: 8,
  },
  docMeta: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
  // Bloc client
  clientSection: {
    marginBottom: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  clientLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: "#6b7280",
  },
  // Tableau des lignes
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderColor: "#1f2937",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderColor: "#e5e7eb",
  },
  colDesignation: { width: "45%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  thText: { fontSize: 8, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" },
  tdText: { fontSize: 9.5, color: "#1f2937" },
  // Totaux
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 24,
  },
  totalsBlock: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 9.5, color: "#6b7280" },
  totalsValue: { fontSize: 9.5, color: "#1f2937" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderColor: "#1f2937",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: "#1f2937" },
  grandTotalValue: { fontSize: 13, fontWeight: 700, color: "#2563eb" },
  // Notes
  notesSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  notesLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  notesText: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.5,
  },
  // Pied de page
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 0.5,
    borderColor: "#e5e7eb",
    paddingTop: 10,
  },
});

const DOC_TYPE_LABELS = {
  quote: "DEVIS",
  invoice: "FACTURE",
};

export function DocumentPDF({ data }: { data: PDFDocumentData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            {data.company.logo_url && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.company.logo_url} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{data.company.name}</Text>
            {data.company.address && (
              <Text style={styles.companyDetail}>{data.company.address}</Text>
            )}
            {data.company.phone && (
              <Text style={styles.companyDetail}>Tél : {data.company.phone}</Text>
            )}
            {data.company.email && (
              <Text style={styles.companyDetail}>{data.company.email}</Text>
            )}
            {data.company.rccm && (
              <Text style={styles.companyDetail}>RCCM : {data.company.rccm}</Text>
            )}
            {data.company.ifu && (
              <Text style={styles.companyDetail}>IFU : {data.company.ifu}</Text>
            )}
            {data.company.cme && (
              <Text style={styles.companyDetail}>CME : {data.company.cme}</Text>
            )}
          </View>

          <View style={styles.docTitleBlock}>
            <Text style={styles.docTitle}>{DOC_TYPE_LABELS[data.type]}</Text>
            <Text style={styles.docNumber}>N° {data.number}</Text>
            <Text style={styles.docMeta}>Date d'émission : {formatDate(data.date)}</Text>
            {data.dueOrValidDate && (
              <Text style={styles.docMeta}>
                {data.type === "quote" ? "Valide jusqu'au" : "Échéance"} :{" "}
                {formatDate(data.dueOrValidDate)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Bloc client ──────────────────────────────────────────────── */}
        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>
            {data.type === "quote" ? "Devis adressé à" : "Facturé à"}
          </Text>
          <Text style={styles.clientName}>{data.client.name}</Text>
          {data.client.address && (
            <Text style={styles.clientDetail}>{data.client.address}</Text>
          )}
          {data.client.phone && (
            <Text style={styles.clientDetail}>Tél : {data.client.phone}</Text>
          )}
          {data.client.email && (
            <Text style={styles.clientDetail}>{data.client.email}</Text>
          )}
        </View>

        {/* ── Tableau des articles ─────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesignation, styles.thText]}>Désignation</Text>
            <Text style={[styles.colQty, styles.thText]}>Qté</Text>
            <Text style={[styles.colPrice, styles.thText]}>Prix unitaire</Text>
            <Text style={[styles.colTotal, styles.thText]}>Total</Text>
          </View>

          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.colDesignation, styles.tdText]}>{item.designation}</Text>
              <Text style={[styles.colQty, styles.tdText]}>{item.quantity}</Text>
              <Text style={[styles.colPrice, styles.tdText]}>
                {formatCurrencyPDF(item.unit_price)}
              </Text>
              <Text style={[styles.colTotal, styles.tdText]}>
                {formatCurrencyPDF(item.total)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Totaux ───────────────────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Sous-total</Text>
              <Text style={styles.totalsValue}>{formatCurrencyPDF(data.subtotal)}</Text>
            </View>

            {data.discount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Remise</Text>
                <Text style={styles.totalsValue}>-{formatCurrencyPDF(data.discount)}</Text>
              </View>
            )}

            {data.tax > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>TVA ({data.taxRate}%)</Text>
                <Text style={styles.totalsValue}>{formatCurrencyPDF(data.tax)}</Text>
              </View>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrencyPDF(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Pied de page ─────────────────────────────────────────────── */}
        <Text style={styles.footer}>
          {/*data.company.name*/}
          {data.company.rccm && ` — RCCM : ${data.company.rccm}`}
          {data.company.ifu && ` — IFU : ${data.company.ifu}`}
          {data.company.cme && ` — CME : ${data.company.cme}`}
          {/* " — Document généré automatiquement par DevisIA" */}
        </Text>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
