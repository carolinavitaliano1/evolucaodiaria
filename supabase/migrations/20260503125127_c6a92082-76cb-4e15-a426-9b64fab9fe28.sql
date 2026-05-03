
CREATE TABLE IF NOT EXISTS public.pending_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  trial_until timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only owners can view pending trials"
  ON public.pending_trials FOR SELECT
  USING (auth.jwt() ->> 'email' IN ('carolinavitaliano1@gmail.com', 'gabriellajf83@gmail.com'));

CREATE POLICY "Only owners can manage pending trials"
  ON public.pending_trials FOR ALL
  USING (auth.jwt() ->> 'email' IN ('carolinavitaliano1@gmail.com', 'gabriellajf83@gmail.com'));

-- Trigger que aplica trial automaticamente ao criar profile
CREATE OR REPLACE FUNCTION public.apply_pending_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_until timestamptz;
BEGIN
  IF NEW.email IS NOT NULL THEN
    SELECT trial_until INTO pending_until
    FROM public.pending_trials
    WHERE lower(email) = lower(NEW.email);

    IF pending_until IS NOT NULL THEN
      NEW.trial_until := pending_until;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_pending_trial_trigger ON public.profiles;
CREATE TRIGGER apply_pending_trial_trigger
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_pending_trial();

-- Pré-cadastra o email solicitado
INSERT INTO public.pending_trials (email, trial_until, note)
VALUES ('espacovilaeden@gmail.com', '2099-12-31 23:59:59+00', 'Conta Pro de teste por tempo indeterminado')
ON CONFLICT (email) DO UPDATE SET trial_until = EXCLUDED.trial_until, note = EXCLUDED.note;

-- Caso o usuário já exista (profile já criado), aplica imediatamente
UPDATE public.profiles
SET trial_until = '2099-12-31 23:59:59+00'
WHERE lower(email) = 'espacovilaeden@gmail.com';
