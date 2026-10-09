ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS quote_pdf_template TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS invoice_pdf_template TEXT NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS quote_pdf_use_header BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invoice_pdf_use_header BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_quote_pdf_template_check,
  ADD CONSTRAINT companies_quote_pdf_template_check
    CHECK (quote_pdf_template IN ('classic', 'modern', 'minimal')),
  DROP CONSTRAINT IF EXISTS companies_invoice_pdf_template_check,
  ADD CONSTRAINT companies_invoice_pdf_template_check
    CHECK (invoice_pdf_template IN ('classic', 'modern', 'minimal'));
