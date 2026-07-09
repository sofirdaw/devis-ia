-- ============================================================================
-- MIGRATION: Ajout des données d'entreprise aux clients
-- ============================================================================
-- Cette migration ajoute:
-- - Champs d'entreprise à la table clients (siret, tva_number, etc.)
-- - Ces données seront utilisées dans les factures et devis
-- ============================================================================

-- ============================================================================
-- MISE À JOUR : clients (ajout données d'entreprise)
-- ============================================================================
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS siret TEXT,
ADD COLUMN IF NOT EXISTS tva_number TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS company_contact_name TEXT,
ADD COLUMN IF NOT EXISTS company_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS company_contact_email TEXT;

-- ============================================================================
-- INDEX pour la recherche par SIRET
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_siret ON clients(siret);
