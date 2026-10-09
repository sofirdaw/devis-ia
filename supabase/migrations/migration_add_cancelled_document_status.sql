ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_status_check,
  ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft', 'sent', 'accepted', 'refused', 'expired', 'cancelled'));

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check,
  ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

ALTER TABLE public.receivables
  DROP CONSTRAINT IF EXISTS receivables_status_check,
  ADD CONSTRAINT receivables_status_check
    CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));

CREATE OR REPLACE FUNCTION prevent_cancelled_document_reactivation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled documents cannot be reactivated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_cancelled_quote_reactivation ON public.quotes;
CREATE TRIGGER trigger_prevent_cancelled_quote_reactivation
  BEFORE UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cancelled_document_reactivation();

DROP TRIGGER IF EXISTS trigger_prevent_cancelled_invoice_reactivation ON public.invoices;
CREATE TRIGGER trigger_prevent_cancelled_invoice_reactivation
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cancelled_document_reactivation();

CREATE OR REPLACE FUNCTION preserve_cancelled_receivable_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelled' OR NEW.status = 'cancelled' THEN
    NEW.status := 'cancelled';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_preserve_cancelled_receivable ON public.receivables;
CREATE TRIGGER trigger_preserve_cancelled_receivable
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION preserve_cancelled_receivable_status();

CREATE OR REPLACE FUNCTION update_receivable_status()
RETURNS TRIGGER AS $$
DECLARE
  computed_remaining NUMERIC(12,2);
BEGIN
  IF OLD.status = 'cancelled' OR NEW.status = 'cancelled' THEN
    NEW.status := 'cancelled';
    RETURN NEW;
  END IF;

  computed_remaining := NEW.total_amount - NEW.paid_amount;

  IF computed_remaining <= 0 THEN
    NEW.status := 'paid';
  ELSIF NEW.paid_amount > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_receivable_status_from_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE public.receivables
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE invoice_id = NEW.id
      AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_receivable_from_invoice ON public.invoices;
CREATE TRIGGER trigger_sync_receivable_from_invoice
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_receivable_status_from_invoice();

CREATE OR REPLACE FUNCTION sync_invoice_status_from_receivable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE public.invoices
    SET status = 'cancelled'
    WHERE id = NEW.invoice_id
      AND status <> 'cancelled';
  ELSIF NEW.status = 'paid' THEN
    UPDATE public.invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id
      AND status NOT IN ('paid', 'cancelled');
  ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    UPDATE public.invoices
    SET status = 'sent'
    WHERE id = NEW.invoice_id
      AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
