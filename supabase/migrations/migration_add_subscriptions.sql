-- ============================================================================
-- MIGRATION : Ajout des colonnes d'abonnement à la table companies
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Active automatiquement l'essai gratuit pour les nouvelles entreprises.
ALTER TABLE companies
  ALTER COLUMN subscription_status SET DEFAULT 'trial',
  ALTER COLUMN trial_started_at SET DEFAULT NOW(),
  ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- Active l'essai gratuit pour les entreprises existantes sans abonnement.
UPDATE companies
SET subscription_status = 'trial',
  trial_started_at = COALESCE(trial_started_at, NOW()),
    trial_ends_at = NOW() + INTERVAL '30 days'
WHERE subscription_status IS NULL
   OR (subscription_status = 'trial' AND trial_ends_at IS NULL);

UPDATE companies
SET trial_started_at = COALESCE(trial_started_at, trial_ends_at - INTERVAL '30 days')
WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL;

UPDATE companies
SET subscription_started_at = CASE subscription_plan
  WHEN 'monthly' THEN subscription_expires_at - INTERVAL '1 month'
  WHEN 'quarter' THEN subscription_expires_at - INTERVAL '3 months'
  WHEN 'year' THEN subscription_expires_at - INTERVAL '1 year'
  ELSE subscription_expires_at
END
WHERE subscription_status = 'active'
  AND subscription_started_at IS NULL
  AND subscription_expires_at IS NOT NULL;

-- Rotation: index pour les recherches basées sur status
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'quarter', 'year')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  order_id TEXT NOT NULL UNIQUE,
  orange_payment_token TEXT,
  orange_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_request_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  user_confirmed_at TIMESTAMPTZ,
  activation_code_hash TEXT,
  activation_code_expires_at TIMESTAMPTZ,
  activation_attempts INTEGER NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ
);

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS payment_request_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS activation_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS refund_status TEXT CHECK (refund_status IN ('pending', 'processed', 'rejected')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_company
  ON subscription_payments(company_id);

CREATE TABLE IF NOT EXISTS subscription_activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES subscription_payments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'quarter', 'year')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by TEXT NOT NULL DEFAULT 'activation_code'
);

CREATE INDEX IF NOT EXISTS idx_subscription_activations_company
  ON subscription_activations(company_id, activated_at DESC);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription payments via company" ON subscription_payments;
CREATE POLICY "subscription payments via company" ON subscription_payments FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "subscription payments insert via company" ON subscription_payments;
CREATE POLICY "subscription payments insert via company" ON subscription_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "subscription payments update via company" ON subscription_payments;
CREATE POLICY "subscription payments update via company" ON subscription_payments FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
