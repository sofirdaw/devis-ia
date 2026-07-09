-- ============================================================================
-- FIX : Désactiver RLS sur suppliers (car l'app utilise Clerk, pas Supabase Auth)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
