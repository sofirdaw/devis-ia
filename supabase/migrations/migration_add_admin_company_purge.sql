CREATE OR REPLACE FUNCTION public.admin_purge_company_data(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id) THEN
    RETURN;
  END IF;

  DELETE FROM payment_transactions
  WHERE receivable_id IN (
    SELECT id FROM receivables WHERE company_id = p_company_id
  );
  DELETE FROM receivables WHERE company_id = p_company_id;
  DELETE FROM quote_items
  WHERE quote_id IN (SELECT id FROM quotes WHERE company_id = p_company_id);
  DELETE FROM invoice_items
  WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = p_company_id);
  DELETE FROM invoices WHERE company_id = p_company_id;
  DELETE FROM quotes WHERE company_id = p_company_id;
  DELETE FROM subscription_activations WHERE company_id = p_company_id;
  DELETE FROM subscription_payments WHERE company_id = p_company_id;
  DELETE FROM client_issue_events WHERE company_id = p_company_id;
  DELETE FROM products WHERE company_id = p_company_id;
  DELETE FROM suppliers WHERE company_id = p_company_id;
  DELETE FROM clients WHERE company_id = p_company_id;
  DELETE FROM companies WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_company_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_company_data(UUID) TO service_role;
