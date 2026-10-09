-- Provides a stable idempotency key for payments queued while offline.
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS offline_sync_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_offline_sync_id_uidx
  ON public.payment_transactions (offline_sync_id)
  WHERE offline_sync_id IS NOT NULL;
