
CREATE TABLE IF NOT EXISTS public.doc_ia_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  default_title TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  example_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_ia_templates_user ON public.doc_ia_templates(user_id);

ALTER TABLE public.doc_ia_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own doc IA templates"
ON public.doc_ia_templates
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_doc_ia_templates_updated_at
BEFORE UPDATE ON public.doc_ia_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
