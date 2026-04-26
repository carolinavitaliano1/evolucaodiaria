ALTER TABLE public.organization_members
ADD COLUMN IF NOT EXISTS weekdays text[] DEFAULT NULL;

COMMENT ON COLUMN public.organization_members.weekdays IS 'Dias da semana de atendimento do colaborador (ex: {seg,ter,qua})';
