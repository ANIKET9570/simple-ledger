
CREATE TYPE public.contact_type AS ENUM ('customer', 'vendor');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type public.contact_type NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, occurred_on DESC);
CREATE INDEX idx_contacts_user ON public.contacts(user_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own contacts select" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own contacts insert" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contacts update" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own contacts delete" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own tx select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tx insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tx update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tx delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
