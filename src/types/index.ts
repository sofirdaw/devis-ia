/**
 * Types TypeScript centralisés pour toute l'application.
 * Ces types correspondent exactement à la structure de la base de données Supabase.
 *
 * Convention :
 * - Type avec "Insert" = données pour créer un enregistrement (sans id/created_at)
 * - Type de base = données complètes retournées par Supabase
 */

// ─── ENTREPRISE ────────────────────────────────────────────────────────────────

export type Company = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  quote_prefix: string; // ex: "DEV"
  invoice_prefix: string; // ex: "FAC"
  tax_rate: number; // TVA par défaut en %
  rccm: string | null; // Registre du Commerce et des Sociétés
  ifu: string | null; // Identifiant Fiscal Unique
  cme: string | null; // Centre des Métiers et de l'Entreprise
  bank_name?: string | null;
  bank_account?: string | null;
  iban?: string | null;
  default_quote_notes: string | null; // Notes par défaut pour les devis
  default_invoice_notes: string | null; // Notes par défaut pour les factures
  created_at: string;
};

export type CompanyInsert = Omit<Company, "id" | "created_at">;

// ─── CLIENTS ───────────────────────────────────────────────────────────────────

export type Client = {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  code?: string | null;
  ifu?: string | null;
  created_at: string;
};

export type ClientInsert = Omit<Client, "id" | "created_at">;

// ─── PRODUITS ──────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  supplier_id: string | null;
  price: number;
  created_at: string;
  // Relations
  supplier?: Supplier | null;
};

export type ProductInsert = Omit<Product, "id" | "created_at" | "supplier">;

// ─── FOURNISSEURS ───────────────────────────────────────────────────────────────

export type Supplier = {
  id: string;
  company_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
};

export type SupplierInsert = Omit<Supplier, "id" | "created_at">;

// ─── DEVIS ─────────────────────────────────────────────────────────────────────

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused";

export type Quote = {
  id: string;
  company_id: string;
  client_id: string;
  quote_number: string;
  status: QuoteStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
  // Relations (jointures Supabase)
  client?: Client;
  quote_items?: QuoteItem[];
};

export type QuoteInsert = Omit<Quote, "id" | "created_at" | "client" | "quote_items">;

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  designation: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type QuoteItemInsert = Omit<QuoteItem, "id">;

// ─── FACTURES ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type Invoice = {
  id: string;
  company_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  // Relations
  client?: Client;
  invoice_items?: InvoiceItem[];
  receivable?: Pick<Receivable, "id" | "paid_amount" | "remaining_amount" | "status"> | null;
};

export type InvoiceInsert = Omit<
  Invoice,
  "id" | "created_at" | "client" | "invoice_items" | "receivable"
>;

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  designation: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type InvoiceItemInsert = Omit<InvoiceItem, "id">;

// ─── CRÉANCES (RECEIVABLES) ─────────────────────────────────────────────────────

export type ReceivableStatus = "pending" | "partial" | "paid" | "overdue";

export type Receivable = {
  id: string;
  company_id: string;
  invoice_id: string;
  client_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: ReceivableStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  client?: Client;
  invoice?: Invoice;
  payment_transactions?: PaymentTransaction[];
};

export type ReceivableInsert = Omit<
  Receivable,
  | "id"
  | "created_at"
  | "updated_at"
  | "remaining_amount"
  | "client"
  | "invoice"
  | "payment_transactions"
>;

export type PaymentMethod = "cash" | "transfer" | "check" | "card" | "other";

export type PaymentTransaction = {
  id: string;
  receivable_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type PaymentTransactionInsert = Omit<PaymentTransaction, "id" | "created_at">;

// ─── IA ────────────────────────────────────────────────────────────────────────

/**
 * Structure retournée par GPT lors d'une génération IA
 */
export type AIGeneratedDocument = {
  client_name: string;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
  }>;
};
