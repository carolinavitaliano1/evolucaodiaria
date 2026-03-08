
-- Create message_templates table for WhatsApp messaging
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own templates"
  ON public.message_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON public.message_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.message_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.message_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default templates
INSERT INTO public.message_templates (user_id, name, category, content) VALUES
  ('00000000-0000-0000-0000-000000000000', '__default_lembrete__', 'lembrete',
   'Olá, {{nome_paciente}}! 😊 Passando para lembrar da sua consulta amanhã, {{data_consulta}} às {{horario}}. Qualquer dúvida, estou à disposição. — {{nome_terapeuta}}'),
  ('00000000-0000-0000-0000-000000000000', '__default_boasvindas__', 'boasvindas',
   'Olá, {{nome_paciente}}! Seja muito bem-vindo(a)! 🌟 Fico feliz em tê-lo(a) como paciente. Em caso de dúvidas ou para confirmar sua próxima sessão, pode me chamar aqui. — {{nome_terapeuta}}'),
  ('00000000-0000-0000-0000-000000000000', '__default_cobranca__', 'cobranca',
   'Olá, {{nome_paciente}}! Espero que esteja bem. Gostaria de informar que há um pagamento referente ao mês em aberto. Por favor, entre em contato para alinhamos. Obrigado(a)! — {{nome_terapeuta}}');
