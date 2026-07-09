-- ============================================================================
-- MIGRATION : Ajout de la table suppliers (fournisseurs)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- ============================================================================
-- TABLE : suppliers
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_search ON suppliers(name);

-- ============================================================================
-- ROW LEVEL SECURITY pour suppliers
-- ============================================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers via company" ON suppliers FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================================
-- Ajout de supplier_id à la table products (optionnel)
-- ============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
