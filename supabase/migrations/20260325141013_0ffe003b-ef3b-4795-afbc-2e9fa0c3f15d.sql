-- Remove o constraint antigo que não aceita o tipo 'clinica'
ALTER TABLE public.clinics DROP CONSTRAINT clinics_type_check;

-- Adiciona o constraint atualizado com os 3 tipos válidos
ALTER TABLE public.clinics ADD CONSTRAINT clinics_type_check 
  CHECK (type = ANY (ARRAY['propria'::text, 'terceirizada'::text, 'clinica'::text]));