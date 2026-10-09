-- Make manual USSD payment requests reusable and subscription approval atomic.

WITH ranked_pending_payments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id
      ORDER BY (user_confirmed_at IS NOT NULL) DESC, created_at DESC, id DESC
    ) AS rank_number
  FROM subscription_payments
  WHERE status = 'pending'
)
UPDATE subscription_payments AS payment
SET status = 'cancelled'
FROM ranked_pending_payments AS ranked
WHERE payment.id = ranked.id
  AND ranked.rank_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_one_pending_per_company
  ON subscription_payments(company_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.create_or_reuse_manual_subscription_payment(
  p_company_id UUID,
  p_plan TEXT,
  p_amount INTEGER,
  p_currency TEXT,
  p_order_id TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE (
  request_id UUID,
  request_order_id TEXT,
  request_plan TEXT,
  request_user_confirmed_at TIMESTAMPTZ,
  reused BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM companies c WHERE c.id = p_company_id AND c.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Entreprise introuvable.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (p_plan = 'monthly' AND p_amount = 300)
    OR (p_plan = 'quarter' AND p_amount = 900)
    OR (p_plan = 'year' AND p_amount = 3500)
  ) THEN
    RAISE EXCEPTION 'Forfait ou montant invalide.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::TEXT));

  UPDATE subscription_payments
  SET status = 'cancelled'
  WHERE company_id = p_company_id
    AND status = 'pending'
    AND payment_request_expires_at IS NOT NULL
    AND payment_request_expires_at <= NOW();

  RETURN QUERY
  SELECT p.id, p.order_id, p.plan, p.user_confirmed_at, TRUE
  FROM subscription_payments p
  WHERE p.company_id = p_company_id
    AND p.status = 'pending'
    AND (p.payment_request_expires_at IS NULL OR p.payment_request_expires_at > NOW())
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH inserted_payment AS (
    INSERT INTO subscription_payments (
      company_id,
      plan,
      amount,
      currency,
      order_id,
      status,
      payment_request_expires_at
    )
    VALUES (
      p_company_id,
      p_plan,
      p_amount,
      p_currency,
      p_order_id,
      'pending',
      p_expires_at
    )
    RETURNING id, order_id, plan, user_confirmed_at
  )
  SELECT
    inserted_payment.id,
    inserted_payment.order_id,
    inserted_payment.plan,
    inserted_payment.user_confirmed_at,
    FALSE
  FROM inserted_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_reuse_manual_subscription_payment(
  UUID, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_manual_subscription_payment(
  UUID, TEXT, INTEGER, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_manual_subscription_payment(p_payment_id UUID)
RETURNS TABLE (
  approved_company_id UUID,
  approved_user_id UUID,
  subscription_expires_at TIMESTAMPTZ,
  already_activated BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  payment_row subscription_payments%ROWTYPE;
  company_user_id UUID;
  current_expiry TIMESTAMPTZ;
  activation_start TIMESTAMPTZ;
  activation_expiry TIMESTAMPTZ;
  activation_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT p.*
  INTO payment_row
  FROM subscription_payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.user_id, c.subscription_expires_at
  INTO company_user_id, current_expiry
  FROM companies c
  WHERE c.id = payment_row.company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entreprise introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF payment_row.status = 'paid' AND payment_row.activated_at IS NOT NULL THEN
    RETURN QUERY
    SELECT payment_row.company_id, company_user_id, current_expiry, TRUE;
    RETURN;
  END IF;

  IF payment_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Demande déjà traitée.' USING ERRCODE = 'P0001';
  END IF;

  IF payment_row.user_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'L’utilisateur n’a pas confirmé son paiement.' USING ERRCODE = 'P0001';
  END IF;

  IF payment_row.payment_request_expires_at IS NOT NULL
     AND payment_row.payment_request_expires_at <= activation_time THEN
    RAISE EXCEPTION 'Cette demande a expiré.' USING ERRCODE = 'P0001';
  END IF;

  IF payment_row.plan NOT IN ('monthly', 'quarter', 'year') THEN
    RAISE EXCEPTION 'Forfait invalide.' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    (payment_row.plan = 'monthly' AND payment_row.amount = 300)
    OR (payment_row.plan = 'quarter' AND payment_row.amount = 900)
    OR (payment_row.plan = 'year' AND payment_row.amount = 3500)
  ) THEN
    RAISE EXCEPTION 'Montant du paiement invalide.' USING ERRCODE = '22023';
  END IF;

  activation_start := GREATEST(COALESCE(current_expiry, activation_time), activation_time);
  activation_expiry := CASE payment_row.plan
    WHEN 'monthly' THEN activation_start + INTERVAL '30 days'
    WHEN 'quarter' THEN activation_start + INTERVAL '3 months'
    WHEN 'year' THEN activation_start + INTERVAL '1 year'
  END;

  UPDATE subscription_payments
  SET status = 'paid',
      paid_at = activation_time,
      activated_at = activation_time
  WHERE id = payment_row.id;

  UPDATE companies
  SET subscription_plan = payment_row.plan,
      subscription_status = 'active',
      subscription_started_at = activation_start,
      subscription_expires_at = activation_expiry
  WHERE id = payment_row.company_id;

  INSERT INTO subscription_activations (payment_id, company_id, plan, activated_by)
  VALUES (payment_row.id, payment_row.company_id, payment_row.plan, 'admin');

  RETURN QUERY
  SELECT payment_row.company_id, company_user_id, activation_expiry, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_manual_subscription_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_manual_subscription_payment(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_orange_subscription_payment(
  p_order_id TEXT,
  p_transaction_id TEXT,
  p_paid_amount INTEGER
)
RETURNS TABLE (
  activated_company_id UUID,
  activated_user_id UUID,
  subscription_expires_at TIMESTAMPTZ,
  already_activated BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  payment_row subscription_payments%ROWTYPE;
  company_user_id UUID;
  current_expiry TIMESTAMPTZ;
  activation_start TIMESTAMPTZ;
  activation_expiry TIMESTAMPTZ;
  activation_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT p.*
  INTO payment_row
  FROM subscription_payments p
  WHERE p.order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande inconnue.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.user_id, c.subscription_expires_at
  INTO company_user_id, current_expiry
  FROM companies c
  WHERE c.id = payment_row.company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entreprise introuvable.' USING ERRCODE = 'P0002';
  END IF;

  IF payment_row.status = 'paid' AND payment_row.activated_at IS NOT NULL THEN
    RETURN QUERY
    SELECT payment_row.company_id, company_user_id, current_expiry, TRUE;
    RETURN;
  END IF;

  IF payment_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Paiement déjà traité.' USING ERRCODE = 'P0001';
  END IF;

  IF payment_row.amount <> p_paid_amount THEN
    RAISE EXCEPTION 'Montant du paiement invalide.' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    (payment_row.plan = 'monthly' AND payment_row.amount = 300)
    OR (payment_row.plan = 'quarter' AND payment_row.amount = 900)
    OR (payment_row.plan = 'year' AND payment_row.amount = 3500)
  ) THEN
    RAISE EXCEPTION 'Forfait ou montant invalide.' USING ERRCODE = '22023';
  END IF;

  activation_start := GREATEST(COALESCE(current_expiry, activation_time), activation_time);
  activation_expiry := CASE payment_row.plan
    WHEN 'monthly' THEN activation_start + INTERVAL '30 days'
    WHEN 'quarter' THEN activation_start + INTERVAL '3 months'
    WHEN 'year' THEN activation_start + INTERVAL '1 year'
  END;

  UPDATE subscription_payments
  SET status = 'paid',
      orange_transaction_id = NULLIF(p_transaction_id, ''),
      paid_at = activation_time,
      activated_at = activation_time
  WHERE id = payment_row.id;

  UPDATE companies
  SET subscription_plan = payment_row.plan,
      subscription_status = 'active',
      subscription_started_at = activation_start,
      subscription_expires_at = activation_expiry
  WHERE id = payment_row.company_id;

  INSERT INTO subscription_activations (payment_id, company_id, plan, activated_by)
  VALUES (payment_row.id, payment_row.company_id, payment_row.plan, 'orange_webhook');

  RETURN QUERY
  SELECT payment_row.company_id, company_user_id, activation_expiry, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_orange_subscription_payment(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_orange_subscription_payment(TEXT, TEXT, INTEGER)
  TO service_role;
