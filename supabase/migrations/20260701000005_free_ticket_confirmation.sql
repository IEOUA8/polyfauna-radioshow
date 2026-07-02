-- Track confirmation delivery for free and courtesy tickets.

ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
