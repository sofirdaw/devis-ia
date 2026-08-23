/**
 * DocumentPDF — Template PDF professionnel pour devis ET factures
 * Design minimaliste "sans entête", haute lisibilité et conforme au modèle A4
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrencyPDF, formatDateNumeric } from "@/lib/utils";
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
    description?: string;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  notes: string | null;
};

// ── Styles react-pdf ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 200,
    paddingBottom: 70,
    paddingHorizontal: 45,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  // Bloc supérieur métadonnées (DATE / ÉCHÉANCE à gauche, DEVIS/FACTURE N° à droite)
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  metaLeft: {
    width: "50%",
  },
  metaLeftText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 3,
  },
  metaRight: {
    width: "50%",
    textAlign: "right",
  },
  metaRightText: {
    fontSize: 14,
    fontWeight: "heavy",
    color: "#111111",
    textAlign: "right",
  },
  // Ligne noire épaisse
  thickLine: {
    width: "100%",
    height: 2.5,
    backgroundColor: "#111111",
    marginBottom: 16,
  },
  // Section Parties (Client à gauche, Code à droite)
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  recipient: {
    width: "60%",
  },
  codeSection: {
    width: "40%",
    textAlign: "right",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 6,
    color: "#111111",
  },
  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 3,
    color: "#111111",
  },
  partyLine: {
    fontSize: 10,
    color: "#222222",
    lineHeight: 1.4,
    marginBottom: 1,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1.5,
    textAlign: "right",
  },
  // Tableau des articles avec bordures noires et en-tête foncé
  table: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#111111",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1.5,
    borderColor: "#111111",
  },
  thText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#111111",
    minHeight: 24,
    alignItems: "center",
  },
  tdText: {
    fontSize: 10,
    color: "#111111",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  colDescription: {
    width: "45%",
    borderRightWidth: 1,
    borderColor: "#111111",
  },
  colPrice: {
    width: "20%",
    textAlign: "right",
    borderRightWidth: 1,
    borderColor: "#111111",
  },
  colQty: {
    width: "15%",
    textAlign: "right",
    borderRightWidth: 1,
    borderColor: "#111111",
  },
  colTotal: {
    width: "20%",
    textAlign: "right",
  },
  descriptionSubtext: {
    fontSize: 8,
    color: "#555555",
    marginTop: 2,
  },
  // Section inférieure (Règlement à gauche, Totaux à droite)
  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  paymentBlock: {
    width: "48%",
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 8,
    color: "#111111",
  },
  paymentText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#222222",
  },
  totalsBox: {
    width: "48%",
    backgroundColor: "#2a2a2a",
    padding: 12,
    borderRadius: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "right",
  },
  // Signature directeur
  directorSection: {
    marginTop: 30,
    alignItems: "flex-end",
  },
  directorLine: {
    width: 170,
    borderBottomWidth: 1.5,
    borderColor: "#111111",
    marginBottom: 4,
  },
  directorLabel: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#111111",
  },
  // Notes et conditions
  footerNote: {
    marginTop: 20,
    fontSize: 8.5,
    color: "#444444",
    lineHeight: 1.4,
  },
});

export function DocumentPDF({ data }: { data: PDFDocumentData }) {
  const isQuote = data.type === "quote";
  const docTitle = isQuote ? "DEVIS N° :" : "FACTURE N° :";
  const emptyRowsCount = Math.max(0, 3 - data.items.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── MÉTADONNÉES SUPÉRIEURES (DATE / ÉCHÉANCE / N°) ─────────────── */}
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaLeftText}>DATE : {formatDateNumeric(data.date)}</Text>
            <Text style={styles.metaLeftText}>
              ÉCHÉANCE : {formatDateNumeric(data.dueOrValidDate || data.date)}
            </Text>
          </View>

          <View style={styles.metaRight}>
            <Text style={styles.metaRightText}>
              {docTitle} {data.number}
            </Text>
          </View>
        </View>

        {/* ── LIGNE ÉPAISSE SÉPARATRICE ─────────────────────────────────── */}
        <View style={styles.thickLine} />

        {/* ── SECTION CLIENT & CODE ─────────────────────────────────────── */}
        <View style={styles.parties}>
          <View style={styles.recipient}>
            <Text style={styles.sectionTitle}>CLIENT :</Text>
            <Text style={styles.partyName}>{data.client.name}</Text>
            {data.client.email && <Text style={styles.partyLine}>{data.client.email}</Text>}
            {data.client.phone && <Text style={styles.partyLine}>{data.client.phone}</Text>}
            {data.client.address && <Text style={styles.partyLine}>{data.client.address}</Text>}
          </View>

          <View style={styles.codeSection}>
            <Text style={styles.codeText}>CODE : {data.client.code || data.client.ifu || "—"}</Text>
          </View>
        </View>

        {/* ── TABLEAU DES ARTICLES ──────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDescription, styles.thText]}>Description :</Text>
            <Text style={[styles.colPrice, styles.thText]}>Prix Unitaire :</Text>
            <Text style={[styles.colQty, styles.thText]}>Quantité :</Text>
            <Text style={[styles.colTotal, styles.thText]}>Total :</Text>
          </View>

          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={[styles.colDescription, { paddingVertical: 5, paddingHorizontal: 8 }]}>
                <Text style={{ fontSize: 9.5, color: "#111111", fontWeight: "medium" }}>
                  {item.designation}
                </Text>
                {item.description && (
                  <Text style={styles.descriptionSubtext}>{item.description}</Text>
                )}
              </View>
              <Text style={[styles.colPrice, styles.tdText]}>
                {formatCurrencyPDF(item.unit_price)}
              </Text>
              <Text style={[styles.colQty, styles.tdText]}>{item.quantity}</Text>
              <Text style={[styles.colTotal, styles.tdText]}>{formatCurrencyPDF(item.total)}</Text>
            </View>
          ))}

          {/* Lignes vides pour compléter la mise en page si peu d'articles */}
          {Array.from({ length: emptyRowsCount }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.tableRow}>
              <Text style={[styles.colDescription, styles.tdText]}>-</Text>
              <Text style={[styles.colPrice, styles.tdText]}>-</Text>
              <Text style={[styles.colQty, styles.tdText]}>-</Text>
              <Text style={[styles.colTotal, styles.tdText]}>-</Text>
            </View>
          ))}
        </View>

        {/* ── SECTION INFÉRIEURE (RÈGLEMENT + TOTAUX) ────────────────────── */}
        <View style={styles.bottomSection}>
          <View style={styles.paymentBlock}>
            <Text style={styles.paymentTitle}>RÈGLEMENT :</Text>
            <View style={styles.paymentText}>
              <Text style={{ marginBottom: 2 }}>Par virement bancaire :</Text>
              <Text style={{ marginBottom: 2 }}>Banque : {data.company.bank_name || "—"}</Text>
              <Text style={{ marginBottom: 2 }}>
                Compte : {data.company.bank_account || data.company.iban || "—"}
              </Text>
              <Text style={{ marginBottom: 2 }}>
                CME : {data.company.cme || data.company.rccm || data.company.ifu || "—"}
              </Text>
            </View>
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL HT :</Text>
              <Text style={styles.totalValue}>{formatCurrencyPDF(data.subtotal)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA {data.taxRate || 0} % :</Text>
              <Text style={styles.totalValue}>{formatCurrencyPDF(data.tax)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>REMISE :</Text>
              <Text style={styles.totalValue}>
                {data.discount > 0 ? `-${formatCurrencyPDF(data.discount)}` : "-"}
              </Text>
            </View>

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL TTC :</Text>
              <Text style={styles.grandTotalValue}>{formatCurrencyPDF(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── SIGNATURE DU DIRECTEUR ────────────────────────────────────── */}
        <View style={styles.directorSection}>
          <View style={styles.directorLine} />
          <Text style={styles.directorLabel}>DIRECTEUR (Signature et cachet)</Text>
        </View>

        {/* ── PIED DE PAGE & CONDITIONS ─────────────────────────────────── */}
        {/*
        <View style={styles.footerNote}>
          <Text style={{ marginBottom: 3 }}>
            En cas de retard de paiement, une indemnité de retard pourra être appliquée selon les conditions prévues.
          </Text>
          {data.notes ? (
            <Text style={{ marginBottom: 3 }}>Notes : {data.notes}</Text>
          ) : (
            <Text style={{ marginBottom: 3 }}>
              Conditions générales de vente consultables auprès de notre service commercial.
            </Text>
          )}
        </View>
        */}
      </Page>
    </Document>
  );
}
