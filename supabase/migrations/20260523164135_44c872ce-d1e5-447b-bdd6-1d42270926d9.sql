
-- Anamnese psicomotricista
CREATE TABLE IF NOT EXISTS public.psicom_anamnese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  user_id uuid NOT NULL,
  motor jsonb NOT NULL DEFAULT '{}'::jsonb,
  familiar jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

ALTER TABLE public.psicom_anamnese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner all psicom_anamnese" ON public.psicom_anamnese
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_psicom_anamnese_updated BEFORE UPDATE ON public.psicom_anamnese
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orientações (família/escola)
CREATE TABLE IF NOT EXISTS public.module_orientacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('psico','psicom')),
  audience text NOT NULL CHECK (audience IN ('familiar','escolar')),
  titulo text NOT NULL DEFAULT 'Orientações',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_orientacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner all module_orientacoes" ON public.module_orientacoes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_module_orientacoes_updated BEFORE UPDATE ON public.module_orientacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_module_orientacoes_patient ON public.module_orientacoes(patient_id, kind);
