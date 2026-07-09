-- ============================================================================
-- MIGRATION: Correction de la synchronisation Créances <-> Factures
-- ============================================================================
-- Corrige 3 bugs découverts dans migration_add_receivables.sql :
--
-- 1) update_receivable_status() lisait NEW.remaining_amount (colonne
--    GENERATED ALWAYS) à l'intérieur d'un trigger BEFORE UPDATE. Postgres ne
--    recalcule les colonnes générées qu'APRÈS l'exécution des triggers BEFORE,
--    donc la fonction voyait toujours l'ancienne valeur et le statut de la
--    créance restait bloqué (ex: "En attente" alors que le solde est à 0).
--
-- 2) Il n'existait aucun trigger AFTER DELETE sur payment_transactions : la
--    suppression d'un paiement ne redonnait donc pas le montant au solde
--    restant (le commentaire du code applicatif supposait à tort que ce
--    trigger existait déjà).
--
-- 3) Aucun mécanisme ne répercutait le statut de la créance (receivables)
--    sur la facture liée (invoices). Résultat : même quand une créance
--    passait à "paid", la facture restait "draft"/"sent" et le KPI
--    "Montant encaissé" de la page Factures affichait 0.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1: Recalcule le statut à partir des colonnes de base (pas de la colonne
-- générée) pour que le résultat soit correct dès ce même trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_receivable_status()
RETURNS TRIGGER AS $$
DECLARE
  computed_remaining NUMERIC(12,2);
BEGIN
  computed_remaining := NEW.total_amount - NEW.paid_amount;

  IF computed_remaining <= 0 THEN
    NEW.status := 'paid';
  ELSIF NEW.paid_amount > 0 AND computed_remaining > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.paid_amount = 0 AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- FIX 2: Trigger manquant pour la suppression d'un paiement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_receivable_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE receivables
  SET paid_amount = GREATEST(paid_amount - OLD.amount, 0),
      updated_at = NOW()
  WHERE id = OLD.receivable_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_receivable_delete ON payment_transactions;
CREATE TRIGGER trigger_payment_receivable_delete
  AFTER DELETE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION decrement_receivable_paid_amount();

-- ----------------------------------------------------------------------------
-- FIX 3: Répercute le statut de la créance sur la facture liée.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_invoice_status_from_receivable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    UPDATE invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id
      AND status <> 'paid';
  ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    -- La créance n'est plus totalement réglée (ex: suppression d'un paiement)
    -- On repasse la facture à "sent" pour refléter qu'elle reste à recouvrer.
    UPDATE invoices
    SET status = 'sent'
    WHERE id = NEW.invoice_id
      AND status = 'paid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_invoice_status ON receivables;
CREATE TRIGGER trigger_sync_invoice_status
  AFTER UPDATE ON receivables
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_invoice_status_from_receivable();

-- ----------------------------------------------------------------------------
-- BACKFILL: recalcule les créances existantes avec la logique corrigée, ce
-- qui déclenchera au passage la synchronisation vers les factures liées.
-- ----------------------------------------------------------------------------
UPDATE receivables
SET updated_at = NOW()
WHERE TRUE;
