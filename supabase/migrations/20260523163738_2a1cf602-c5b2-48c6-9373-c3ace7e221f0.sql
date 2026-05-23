ALTER TABLE public.psico_reunioes DROP CONSTRAINT IF EXISTS psico_reunioes_modalidade_check;
ALTER TABLE public.psico_reunioes ADD CONSTRAINT psico_reunioes_modalidade_check CHECK (modalidade = ANY (ARRAY['presencial'::text, 'online'::text, 'teleatendimento'::text]));

ALTER TABLE public.psicom_reunioes DROP CONSTRAINT IF EXISTS psicom_reunioes_modalidade_check;
ALTER TABLE public.psicom_reunioes ADD CONSTRAINT psicom_reunioes_modalidade_check CHECK (modalidade = ANY (ARRAY['presencial'::text, 'online'::text, 'teleatendimento'::text]));