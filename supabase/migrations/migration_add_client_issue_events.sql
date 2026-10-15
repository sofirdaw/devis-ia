CREATE TABLE IF NOT EXISTS public.client_issue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'runtime_error',
      'unhandled_rejection',
      'connection_lost',
      'connection_restored',
      'ai_generation_failed',
      'ai_generation_succeeded',
      'session_started',
      'page_view'
    )
  ),
  error_code TEXT,
  route TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_issue_events_company_created
  ON public.client_issue_events(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_issue_events_created
  ON public.client_issue_events(created_at);

ALTER TABLE public.client_issue_events
  ADD COLUMN IF NOT EXISTS error_code TEXT;

ALTER TABLE public.client_issue_events ENABLE ROW LEVEL SECURITY;
