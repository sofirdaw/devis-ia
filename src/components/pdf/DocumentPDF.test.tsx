import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { convertLogoToJpeg } from "@/lib/company-logo";
import { DocumentPDF, type PDFDocumentData } from "./DocumentPDF";

const pdfData: PDFDocumentData = {
  type: "invoice",
  number: "FAC-2026-001",
  status: "paid",
  date: "2026-10-08T00:00:00.000Z",
  dueOrValidDate: "2026-11-08T00:00:00.000Z",
  client: {
    id: "client-1",
    company_id: "company-1",
    name: "Client de test",
    phone: "+226 70 00 00 00",
    email: "client@example.com",
    address: "Ouagadougou",
    created_at: "2026-10-08T00:00:00.000Z",
  },
  company: {
    id: "company-1",
    user_id: "user-1",
    name: "Entreprise de test",
    phone: "+226 60 00 00 00",
    email: "contact@example.com",
    address: "Ouagadougou",
    service_description: "Vente et maintenance informatique",
    logo_url: null,
    quote_prefix: "DEV",
    invoice_prefix: "FAC",
    tax_rate: 18,
    rccm: "BF-OUA-123",
    ifu: "12345678",
    cme: "CME-001",
    default_quote_notes: null,
    default_invoice_notes: null,
    created_at: "2026-10-08T00:00:00.000Z",
  },
  items: [
    { designation: "Ordinateur", quantity: 2, unit_price: 1000, total: 2000 },
    { designation: "Imprimante", quantity: 1, unit_price: 1000, total: 1000 },
  ],
  subtotal: 3000,
  discount: 0,
  tax: 540,
  taxRate: 18,
  total: 3540,
  notes: "Merci pour votre confiance.",
};

describe("DocumentPDF", () => {
  it.each(["classic", "modern", "minimal"] as const)(
    "renders a valid PDF using the %s design",
    async (template) => {
      const buffer = await renderToBuffer(<DocumentPDF data={{ ...pdfData, template }} />);

      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
  );

  it.each([
    ["quote", "draft"],
    ["invoice", "paid"],
  ] as const)("renders a %s with print margins and no company header", async (type, status) => {
    const buffer = await renderToBuffer(
      <DocumentPDF
        data={{
          ...pdfData,
          type,
          status,
          template: "minimal",
          useHeader: false,
        }}
      />
    );

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it.each(["quote", "invoice"] as const)(
    "embeds the company logo in a %s after converting a WebP upload",
    async (type) => {
      const webpLogo = await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 4,
          background: { r: 30, g: 58, b: 95, alpha: 1 },
        },
      })
        .webp()
        .toBuffer();
      const jpegLogo = await convertLogoToJpeg(new Blob([webpLogo], { type: "image/webp" }));
      const data = {
        ...pdfData,
        type,
        company: {
          ...pdfData.company,
          logo_url: `data:image/jpeg;base64,${jpegLogo.toString("base64")}`,
        },
      };

      const buffer = await renderToBuffer(<DocumentPDF data={data} />);
      const pdfContent = buffer.toString("latin1");

      expect(pdfContent.startsWith("%PDF-")).toBe(true);
      expect(pdfContent).toContain("/Subtype /Image");
    }
  );
});
