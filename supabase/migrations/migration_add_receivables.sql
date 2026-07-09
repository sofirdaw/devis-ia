-- ============================================================================
-- MIGRATION: Ajout du système de créances (receivables)
-- ============================================================================
-- Cette migration ajoute:
-- - Table receivables pour le suivi des paiements partiels
-- - Table payment_transactions pour l'historique des paiements
-- - Fonctions pour le calcul automatique des restes à payer
-- - RLS policies pour receivables et payment_transactions
-- ============================================================================

-- ============================================================================
-- TABLE : receivables (créances)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receivables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) NOT NULL GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT receivables_invoice_unique UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_receivables_company ON receivables(company_id);
CREATE INDEX IF NOT EXISTS idx_receivables_invoice ON receivables(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receivables_client ON receivables(client_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);

-- ============================================================================
-- TABLE : payment_transactions (historique des paiements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receivable_id   UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash', 'transfer', 'check', 'card', 'other')),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_receivable ON payment_transactions(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(payment_date);

-- ============================================================================
-- TRIGGER: updated_at pour receivables
-- ============================================================================
CREATE TRIGGER update_receivables_updated_at
  BEFORE UPDATE ON receivables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FONCTION: Mettre à jour le statut d'une créance
-- ============================================================================
CREATE OR REPLACE FUNCTION update_receivable_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.remaining_amount = 0 THEN
    NEW.status := 'paid';
  ELSIF NEW.paid_amount > 0 AND NEW.remaining_amount > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.paid_amount = 0 AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_receivable_status
  BEFORE UPDATE ON receivables
  FOR EACH ROW
  EXECUTE FUNCTION update_receivable_status();

-- ============================================================================
-- FONCTION: Mettre à jour le montant payé d'une créance après un paiement
-- ============================================================================
CREATE OR REPLACE FUNCTION update_receivable_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE receivables
  SET paid_amount = paid_amount + NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.receivable_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_receivable_update
  AFTER INSERT ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_receivable_paid_amount();

-- ============================================================================
-- FONCTION: Créer automatiquement une créance lors de la création d'une facture
-- ============================================================================
CREATE OR REPLACE FUNCTION create_receivable_for_invoice()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO receivables (company_id, invoice_id, client_id, total_amount, due_date)
  VALUES (
    NEW.company_id,
    NEW.id,
    NEW.client_id,
    NEW.total,
    NEW.due_date
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_receivable
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_receivable_for_invoice();

-- ============================================================================
-- ROW LEVEL SECURITY pour receivables
-- ============================================================================
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receivables via company" ON receivables FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "payment_transactions via receivable" ON payment_transactions FOR ALL
  USING (receivable_id IN (
    SELECT r.id FROM receivables r
    JOIN companies c ON c.id = r.company_id
    WHERE c.user_id = auth.uid()
  ));
