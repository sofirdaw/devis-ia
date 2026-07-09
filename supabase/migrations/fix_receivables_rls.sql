-- ============================================================================
-- FIX : Désactiver RLS sur receivables et payment_transactions (car l'app utilise Clerk, pas Supabase Auth)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

ALTER TABLE receivables DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;
