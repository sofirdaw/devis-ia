-- Autorise l'utilisateur d'une entreprise à créer et suivre ses paiements.
-- La politique historique comparait UUID et texte et ne couvrait que SELECT.

DROP POLICY IF EXISTS "subscription payments via company" ON subscription_payments;
DROP POLICY IF EXISTS "subscription payments insert via company" ON subscription_payments;
DROP POLICY IF EXISTS "subscription payments update via company" ON subscription_payments;

CREATE POLICY "subscription payments via company" ON subscription_payments FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id::TEXT = auth.uid()::TEXT));

CREATE POLICY "subscription payments insert via company" ON subscription_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id::TEXT = auth.uid()::TEXT));

CREATE POLICY "subscription payments update via company" ON subscription_payments FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id::TEXT = auth.uid()::TEXT))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id::TEXT = auth.uid()::TEXT));
