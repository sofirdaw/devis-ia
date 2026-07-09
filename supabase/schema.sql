-- ============================================================================
-- SCHEMA COMPLET — Assistant IA Devis & Facturation
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE : companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  logo_url        TEXT,
  quote_prefix    TEXT NOT NULL DEFAULT 'DEV',
  invoice_prefix  TEXT NOT NULL DEFAULT 'FAC',
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  password_hash   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companies_user_id_unique UNIQUE (user_id)
);

-- ============================================================================
-- TABLE : clients
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_name_search ON clients(name);

-- ============================================================================
-- TABLE : products
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

-- ============================================================================
-- TABLE : quotes
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  quote_number  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','accepted','refused')),
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  valid_until   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quotes_number_unique UNIQUE (company_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status  ON quotes(status);

-- ============================================================================
-- TABLE : quote_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

-- ============================================================================
-- TABLE : invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  quote_id        UUID REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','paid','overdue')),
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_number_unique UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);

-- ============================================================================
-- TABLE : invoice_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================================
-- FONCTION : numéro de document automatique
-- Usage : SELECT next_document_number('uuid', 'quotes', 'DEV')
-- ============================================================================
CREATE OR REPLACE FUNCTION next_document_number(
  p_company_id UUID,
  p_table      TEXT,
  p_prefix     TEXT
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
  v_year  TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  IF p_table = 'quotes' THEN
    SELECT COUNT(*) INTO v_count FROM quotes
    WHERE company_id = p_company_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  ELSE
    SELECT COUNT(*) INTO v_count FROM invoices
    WHERE company_id = p_company_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  END IF;
  RETURN p_prefix || '-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- companies
CREATE POLICY "own company" ON companies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- clients
CREATE POLICY "clients via company" ON clients FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- products
CREATE POLICY "products via company" ON products FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- quotes
CREATE POLICY "quotes via company" ON quotes FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- quote_items
CREATE POLICY "quote_items via quote" ON quote_items FOR ALL
  USING (quote_id IN (
    SELECT q.id FROM quotes q
    JOIN companies c ON c.id = q.company_id
    WHERE c.user_id = auth.uid()
  ));

-- invoices
CREATE POLICY "invoices via company" ON invoices FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- invoice_items
CREATE POLICY "invoice_items via invoice" ON invoice_items FOR ALL
  USING (invoice_id IN (
    SELECT i.id FROM invoices i
    JOIN companies c ON c.id = i.company_id
    WHERE c.user_id = auth.uid()
  ));

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('pdfs', 'pdfs', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logos public read"   ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos auth upload"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "pdfs auth all"       ON storage.objects FOR ALL
  USING (bucket_id = 'pdfs' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'pdfs' AND auth.role() = 'authenticated');
