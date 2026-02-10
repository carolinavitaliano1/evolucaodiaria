
CREATE TABLE public.custom_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom service types"
ON public.custom_service_types FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom service types"
ON public.custom_service_types FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom service types"
ON public.custom_service_types FOR DELETE
USING (auth.uid() = user_id);
