ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS refund_status TEXT
    CHECK (refund_status IN ('pending', 'processed', 'rejected')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;