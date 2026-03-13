
-- Add remuneration_type and remuneration_value columns to organization_members
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS remuneration_type text DEFAULT 'definir_depois',
  ADD COLUMN IF NOT EXISTS remuneration_value numeric DEFAULT NULL;

-- Add constraint for valid remuneration types
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_remuneration_type_check
  CHECK (remuneration_type IN ('por_sessao', 'fixo_mensal', 'fixo_dia', 'definir_depois'));
