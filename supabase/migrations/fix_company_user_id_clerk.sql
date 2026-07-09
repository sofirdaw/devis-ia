-- ============================================================================
-- MIGRATION: Correction du type de companies.user_id pour Clerk
-- ============================================================================
-- `companies.user_id` était typé UUID, un reliquat de l'ancienne intégration
-- Supabase Auth. Or l'application utilise Clerk, dont les identifiants
-- utilisateur sont des chaînes du type "user_XXXXXXXXXXXXXXXXXXXXXXXXXXXX"
-- (PAS des UUID). Toute comparaison `user_id = <id Clerk>` échouait donc avec
-- une erreur Postgres ("invalid input syntax for type uuid"), ce qui rendait
-- impossible toute résolution fiable de "l'entreprise de l'utilisateur
-- connecté" — d'où le recours (fragile) au pattern "prendre la première
-- entreprise trouvée", qui provoquait des incohérences entre les pages
-- (créer un fournisseur pour une entreprise, puis atterrir sur une autre
-- entreprise "première" par hasard sur la page suivante).
-- ============================================================================

-- Ces policies RLS référencent companies.user_id et bloquent l'ALTER TYPE.
-- Elles sont de toute façon inertes : RLS est désactivé sur toutes ces tables
-- (cf. disable_rls.sql) et elles reposaient sur `auth.uid()` de Supabase Auth,
-- incompatible avec Clerk (qui n'alimente jamais ce contexte). On les
-- supprime ; une vraie politique RLS compatible Clerk devra être reçue
-- ultérieurement si RLS est réactivé.
DROP POLICY IF EXISTS "clients via company" ON clients;
DROP POLICY IF EXISTS "delivery_note_items via delivery_note" ON delivery_note_items;
DROP POLICY IF EXISTS "delivery_notes via company" ON delivery_notes;
DROP POLICY IF EXISTS "invoice_items via invoice" ON invoice_items;
DROP POLICY IF EXISTS "invoices via company" ON invoices;
DROP POLICY IF EXISTS "order_items via order" ON order_items;
DROP POLICY IF EXISTS "orders via company" ON orders;
DROP POLICY IF EXISTS "payment_transactions via receivable" ON payment_transactions;
DROP POLICY IF EXISTS "products via company" ON products;
DROP POLICY IF EXISTS "quote_items via quote" ON quote_items;
DROP POLICY IF EXISTS "quotes via company" ON quotes;
DROP POLICY IF EXISTS "receivables via company" ON receivables;
DROP POLICY IF EXISTS "admin full access" ON staff;
DROP POLICY IF EXISTS "staff via company" ON staff;
DROP POLICY IF EXISTS "suppliers via company" ON suppliers;

-- Cette contrainte pointait vers auth.users(id) (Supabase Auth), obsolète
-- depuis le passage à Clerk : les identifiants Clerk ne vivent pas dans
-- auth.users et ne sont de toute façon pas des UUID.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_user_id_fkey;

ALTER TABLE companies ALTER COLUMN user_id TYPE TEXT;

-- ----------------------------------------------------------------------------
-- Rattache l'entreprise la plus riche en données (celle visiblement utilisée
-- activement, cf. clients/produits/fournisseurs/devis/factures existants) au
-- seul compte Clerk réel trouvé dans le projet.
--
-- ⚠️ Ne PAS relancer ce bloc pour un projet ayant plusieurs vrais utilisateurs
-- Clerk : il associe explicitement UNE entreprise à UN utilisateur précis.
-- ----------------------------------------------------------------------------
UPDATE companies
SET user_id = 'user_3FfnjqPGbt2cMhw7KNc72gfyZjl'
WHERE id = 'aaabbbbe-659d-4b89-90ca-05693d73a4af';
