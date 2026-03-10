import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_CATEGORIES = [
  { id: 'lembrete',   label: 'Lembrete de Consulta', emoji: '🗓️' },
  { id: 'boasvindas', label: 'Boas-vindas',           emoji: '👋' },
  { id: 'cobranca',   label: 'Cobrança',              emoji: '💰' },
  { id: 'relatorio',  label: 'Envio de Relatório',    emoji: '📄' },
  { id: 'geral',      label: 'Geral',                 emoji: '💬' },
];

export const TEMPLATE_VARIABLES = [
  // Paciente
  { tag: '{{nome_paciente}}',        label: 'Nome do Paciente',         group: 'Paciente' },
  { tag: '{{telefone_paciente}}',    label: 'Telefone do Paciente',     group: 'Paciente' },
  { tag: '{{email_paciente}}',       label: 'E-mail do Paciente',       group: 'Paciente' },
  { tag: '{{data_nascimento}}',      label: 'Data de Nascimento',       group: 'Paciente' },
  { tag: '{{responsavel}}',          label: 'Nome do Responsável',      group: 'Paciente' },
  // Consulta
  { tag: '{{data_consulta}}',        label: 'Data da Consulta',         group: 'Consulta' },
  { tag: '{{horario}}',              label: 'Horário',                  group: 'Consulta' },
  { tag: '{{dia_semana}}',           label: 'Dia da Semana',            group: 'Consulta' },
  { tag: '{{valor_sessao}}',         label: 'Valor da Sessão',          group: 'Consulta' },
  { tag: '{{valor_em_aberto}}',      label: 'Valor em Aberto',          group: 'Consulta' },
  // Profissional / Clínica
  { tag: '{{nome_terapeuta}}',       label: 'Nome do Terapeuta',        group: 'Profissional' },
  { tag: '{{nome_clinica}}',         label: 'Nome da Clínica',          group: 'Profissional' },
  { tag: '{{endereco_clinica}}',     label: 'Endereço da Clínica',      group: 'Profissional' },
  { tag: '{{telefone_clinica}}',     label: 'Telefone da Clínica',      group: 'Profissional' },
];

/** Default templates shown when user has none (copies seeded with null user_id are filtered) */
export const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Lembrete de Consulta',
    category: 'lembrete',
    content: 'Olá, {{nome_paciente}}! 😊 Passando para lembrar da sua consulta amanhã, {{data_consulta}} às {{horario}}. Qualquer dúvida, estou à disposição. — {{nome_terapeuta}}',
  },
  {
    name: 'Boas-vindas',
    category: 'boasvindas',
    content: 'Olá, {{nome_paciente}}! Seja muito bem-vindo(a)! 🌟 Fico feliz em tê-lo(a) como paciente. Em caso de dúvidas ou para confirmar sua próxima sessão, pode me chamar aqui. — {{nome_terapeuta}}',
  },
  {
    name: 'Cobrança',
    category: 'cobranca',
    content: 'Olá, {{nome_paciente}}! Espero que esteja bem. Gostaria de informar que há um pagamento referente ao mês em aberto. Por favor, entre em contato para alinhamos. Obrigado(a)! — {{nome_terapeuta}}',
  },
];

export function useMessageTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (!error) setTemplates(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function createTemplate(t: { name: string; category: string; content: string }) {
    if (!user) return;
    const { error } = await supabase.from('message_templates').insert({ ...t, user_id: user.id });
    if (error) { toast.error('Erro ao criar modelo'); return; }
    toast.success('Modelo criado!');
    load();
  }

  async function updateTemplate(id: string, t: { name: string; category: string; content: string }) {
    const { error } = await supabase.from('message_templates').update(t).eq('id', id);
    if (error) { toast.error('Erro ao salvar modelo'); return; }
    toast.success('Modelo salvo!');
    load();
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir modelo'); return; }
    toast.success('Modelo excluído');
    load();
  }

  /** Seed default templates for a new user */
  async function seedDefaults() {
    if (!user || templates.length > 0) return;
    for (const t of DEFAULT_TEMPLATES) {
      await supabase.from('message_templates').insert({ ...t, user_id: user.id });
    }
    load();
  }

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, seedDefaults, refresh: load };
}

export interface TemplateVars {
  nome_paciente?: string;
  telefone_paciente?: string;
  email_paciente?: string;
  data_nascimento?: string;
  responsavel?: string;
  data_consulta?: string;
  horario?: string;
  dia_semana?: string;
  valor_sessao?: string;
  valor_em_aberto?: string;
  nome_terapeuta?: string;
  nome_clinica?: string;
  endereco_clinica?: string;
  telefone_clinica?: string;
}

/** Replace template variables with actual values */
export function resolveTemplate(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{\{nome_paciente\}\}/g,      vars.nome_paciente      || '')
    .replace(/\{\{telefone_paciente\}\}/g,  vars.telefone_paciente  || '')
    .replace(/\{\{email_paciente\}\}/g,     vars.email_paciente     || '')
    .replace(/\{\{data_nascimento\}\}/g,    vars.data_nascimento    || '')
    .replace(/\{\{responsavel\}\}/g,        vars.responsavel        || '')
    .replace(/\{\{data_consulta\}\}/g,      vars.data_consulta      || '')
    .replace(/\{\{horario\}\}/g,            vars.horario            || '')
    .replace(/\{\{dia_semana\}\}/g,         vars.dia_semana         || '')
    .replace(/\{\{valor_sessao\}\}/g,       vars.valor_sessao       || '')
    .replace(/\{\{valor_em_aberto\}\}/g,    vars.valor_em_aberto    || '')
    .replace(/\{\{nome_terapeuta\}\}/g,     vars.nome_terapeuta     || '')
    .replace(/\{\{nome_clinica\}\}/g,       vars.nome_clinica       || '')
    .replace(/\{\{endereco_clinica\}\}/g,   vars.endereco_clinica   || '')
    .replace(/\{\{telefone_clinica\}\}/g,   vars.telefone_clinica   || '');
}

/** Open WhatsApp with a pre-filled message.
 *  Uses a real <a> element appended to the body so popup blockers
 *  treat it as a genuine user-initiated navigation. */
export function openWhatsApp(phone: string, message: string) {
  const cleaned = phone.replace(/\D/g, '');
  // If no country code, assume Brazil (+55)
  const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
