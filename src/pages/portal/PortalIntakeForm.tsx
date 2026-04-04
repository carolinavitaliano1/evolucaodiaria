import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, ClipboardList, ChevronRight, ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntakeForm {
  full_name: string;
  cpf: string;
  birthdate: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  gender: string;
  how_found: string;
  emergency_contact_name: string;
  emergency_contact_relation: string;
  emergency_contact_address: string;
  emergency_contact_phone: string;
  responsible_name: string;
  responsible_cpf: string;
  responsible_phone: string;
  financial_responsible_name: string;
  financial_responsible_email: string;
  financial_responsible_cpf: string;
  financial_responsible_relation: string;
  financial_responsible_address: string;
  financial_responsible_phone: string;
  health_info: string;
  observations: string;
  payment_due_day: string;
}

interface CustomQuestion {
  id: string;
  question: string;
  field_type: 'text' | 'textarea' | 'select' | 'yesno';
  options: string[];
  required: boolean;
  sort_order: number;
}

const empty: IntakeForm = {
  full_name: '', cpf: '', birthdate: '', phone: '', whatsapp: '', email: '',
  address: '', gender: '', how_found: '',
  emergency_contact_name: '', emergency_contact_relation: '',
  emergency_contact_address: '', emergency_contact_phone: '',
  responsible_name: '', responsible_cpf: '', responsible_phone: '',
  financial_responsible_name: '', financial_responsible_email: '',
  financial_responsible_cpf: '', financial_responsible_relation: '',
  financial_responsible_address: '', financial_responsible_phone: '',
  health_info: '', observations: '', payment_due_day: '',
};

const PAYMENT_DAY_OPTIONS = [
  { label: 'Dia 5', value: '5' },
  { label: 'Dia 10', value: '10' },
  { label: 'Dia 15', value: '15' },
  { label: 'Dia 20', value: '20' },
];

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Prefiro não dizer', value: 'nao_informar' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CustomQuestionField({
  question,
  value,
  onChange,
}: {
  question: CustomQuestion;
  value: string;
  onChange: (val: string) => void;
}) {
  const label = question.required ? `${question.question} *` : question.question;

  if (question.field_type === 'textarea') {
    return (
      <Field label={label}>
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Sua resposta..."
          className="resize-none"
          rows={3}
        />
      </Field>
    );
  }

  if (question.field_type === 'yesno') {
    return (
      <Field label={label}>
        <div className="grid grid-cols-2 gap-2">
          {['Sim', 'Não'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                'rounded-xl border py-2 text-xs font-medium transition-colors',
                value === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 border-border text-foreground hover:bg-muted'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>
    );
  }

  if (question.field_type === 'select') {
    return (
      <Field label={label}>
        <div className="flex flex-wrap gap-2">
          {(question.options || []).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                value === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 border-border text-foreground hover:bg-muted'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>
    );
  }

  // default: text
  return (
    <Field label={label}>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Sua resposta..." />
    </Field>
  );
}

interface PatientQuestionnaire {
  id: string;
  title: string;
  fields: Array<{ id: string; question: string; field_type: string; options?: string[]; required?: boolean }>;
  answers: Record<string, string>;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

export default function PortalIntakeForm() {
  const { portalAccount } = usePortal();
  const [form, setForm] = useState<IntakeForm>(empty);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customDay, setCustomDay] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [questionnaires, setQuestionnaires] = useState<PatientQuestionnaire[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'intake' | 'questionnaire'>('list');
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<PatientQuestionnaire | null>(null);
  const [qAnswers, setQAnswers] = useState<Record<string, string>>({});
  const [savingQ, setSavingQ] = useState(false);

  useEffect(() => {
    if (!portalAccount) return;

    const loadData = async () => {
      // Load intake form
      const { data: formData } = await supabase
        .from('patient_intake_forms')
        .select('*')
        .eq('patient_id', portalAccount.patient_id)
        .maybeSingle();

      if (formData) {
        const d = formData as any;
        const dayVal = d.payment_due_day ? String(d.payment_due_day) : '';
        const isPreset = PAYMENT_DAY_OPTIONS.some(o => o.value === dayVal);
        setCustomDay(!!dayVal && !isPreset);
        setForm({
          full_name: d.full_name || '',
          cpf: d.cpf || '',
          birthdate: d.birthdate || '',
          phone: d.phone || '',
          whatsapp: d.whatsapp || '',
          email: d.email || '',
          address: d.address || '',
          gender: d.gender || '',
          how_found: d.how_found || '',
          emergency_contact_name: d.emergency_contact_name || '',
          emergency_contact_relation: d.emergency_contact_relation || '',
          emergency_contact_address: d.emergency_contact_address || '',
          emergency_contact_phone: d.emergency_contact_phone || '',
          responsible_name: d.responsible_name || '',
          responsible_cpf: d.responsible_cpf || '',
          responsible_phone: d.responsible_phone || '',
          financial_responsible_name: d.financial_responsible_name || '',
          financial_responsible_email: d.financial_responsible_email || '',
          financial_responsible_cpf: d.financial_responsible_cpf || '',
          financial_responsible_relation: d.financial_responsible_relation || '',
          financial_responsible_address: d.financial_responsible_address || '',
          financial_responsible_phone: d.financial_responsible_phone || '',
          health_info: d.health_info || '',
          observations: d.observations || '',
          payment_due_day: dayVal,
        });
        if (d.submitted_at) setSubmitted(true);
        if (d.custom_answers && typeof d.custom_answers === 'object') {
          setCustomAnswers(d.custom_answers as Record<string, string>);
        }
      }

      // Load custom questions from therapist
      const { data: questionsData } = await supabase
        .from('intake_custom_questions' as any)
        .select('*')
        .eq('user_id', portalAccount.therapist_user_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      setCustomQuestions((questionsData || []) as unknown as CustomQuestion[]);

      // Load patient questionnaires
      const { data: qData } = await supabase
        .from('patient_questionnaires')
        .select('*')
        .eq('patient_id', portalAccount.patient_id)
        .order('created_at', { ascending: false });
      setQuestionnaires((qData || []) as unknown as PatientQuestionnaire[]);

      setLoading(false);
    };

    loadData();
  }, [portalAccount]);

  const set = (field: keyof IntakeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const setAnswer = (questionId: string, value: string) =>
    setCustomAnswers(prev => ({ ...prev, [questionId]: value }));

  const handleSave = async (submit = false) => {
    if (!portalAccount) return;

    // Validate required custom questions if submitting
    if (submit) {
      const missing = customQuestions.filter(q => q.required && !customAnswers[q.id]?.trim());
      if (missing.length > 0) {
        toast.error(`Preencha as perguntas obrigatórias: ${missing.map(q => `"${q.question}"`).join(', ')}`);
        return;
      }
    }

    setSaving(true);
    try {
      const paymentDueDay = form.payment_due_day ? parseInt(form.payment_due_day, 10) : null;

      let reviewHistoryUpdate: Record<string, any> = {};
      if (submit && submitted) {
        const { data: currentForm } = await supabase
          .from('patient_intake_forms')
          .select('*')
          .eq('patient_id', portalAccount.patient_id)
          .maybeSingle();

        if (currentForm) {
          const snapshot = {
            submitted_at: new Date().toISOString(),
            data: { ...form, custom_answers: customAnswers },
          };
          const existingHistory = Array.isArray((currentForm as any).review_history) ? (currentForm as any).review_history : [];
          reviewHistoryUpdate = {
            review_history: [...existingHistory, snapshot],
            needs_review: true,
            review_status: 'pending',
            reviewed_at: null,
          };
        }
      }

      const payload: Record<string, any> = {
        patient_id: portalAccount.patient_id,
        therapist_user_id: portalAccount.therapist_user_id,
        ...form,
        birthdate: form.birthdate || null,
        payment_due_day: paymentDueDay,
        custom_answers: customAnswers,
        updated_at: new Date().toISOString(),
        ...reviewHistoryUpdate,
      };
      if (submit) payload.submitted_at = new Date().toISOString();

      const { error } = await supabase
        .from('patient_intake_forms')
        .upsert(payload, { onConflict: 'patient_id' });
      if (error) throw error;

      if (submit) {
        setSubmitted(true);
        if (submitted) {
          toast.success('Dados atualizados! Seu terapeuta será notificado para revisar. ✅');
        } else {
          toast.success('Ficha enviada ao terapeuta! ✅');
        }
      } else {
        toast.success('Rascunho salvo');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const openQuestionnaire = (q: PatientQuestionnaire) => {
    setActiveQuestionnaire(q);
    setQAnswers((q.answers as Record<string, string>) || {});
    setActiveView('questionnaire');
  };

  const handleSubmitQuestionnaire = async () => {
    if (!activeQuestionnaire) return;
    const requiredMissing = activeQuestionnaire.fields.filter(f => f.required && !qAnswers[f.id]?.trim());
    if (requiredMissing.length > 0) {
      toast.error(`Preencha as perguntas obrigatórias: ${requiredMissing.map(f => `"${f.question}"`).join(', ')}`);
      return;
    }
    setSavingQ(true);
    try {
      const { error } = await supabase
        .from('patient_questionnaires')
        .update({ answers: qAnswers as any, status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', activeQuestionnaire.id);
      if (error) throw error;
      setQuestionnaires(prev => prev.map(q => q.id === activeQuestionnaire.id ? { ...q, answers: qAnswers, status: 'submitted', submitted_at: new Date().toISOString() } : q));
      toast.success('Questionário enviado! ✅');
      setActiveView('list');
      setActiveQuestionnaire(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setSavingQ(false);
    }
  };

  if (loading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </PortalLayout>
  );

  // Questionnaire fill view
  if (activeView === 'questionnaire' && activeQuestionnaire) {
    const isSubmitted = activeQuestionnaire.status === 'submitted' || activeQuestionnaire.status === 'reviewed';
    return (
      <PortalLayout>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setActiveView('list'); setActiveQuestionnaire(null); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{activeQuestionnaire.title}</h1>
              <p className="text-xs text-muted-foreground">{isSubmitted ? 'Enviado' : 'Preencha e envie ao terapeuta'}</p>
            </div>
          </div>

          {isSubmitted && (
            <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Enviado em {activeQuestionnaire.submitted_at ? format(new Date(activeQuestionnaire.submitted_at), "d/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}</span>
            </div>
          )}

          <div className="space-y-4">
            {activeQuestionnaire.fields.map((field, idx) => (
              <SectionCard key={field.id} title={`${idx + 1}. ${field.question}${field.required ? ' *' : ''}`}>
                {field.field_type === 'textarea' ? (
                  <Textarea
                    value={qAnswers[field.id] || ''}
                    onChange={e => setQAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder="Sua resposta..."
                    className="resize-none"
                    rows={3}
                    disabled={isSubmitted}
                  />
                ) : field.field_type === 'yesno' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {['Sim', 'Não'].map(opt => (
                      <button key={opt} type="button" disabled={isSubmitted}
                        onClick={() => setQAnswers(prev => ({ ...prev, [field.id]: opt }))}
                        className={cn('rounded-xl border py-2 text-xs font-medium transition-colors',
                          qAnswers[field.id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted')}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : field.field_type === 'select' ? (
                  <div className="flex flex-wrap gap-2">
                    {(field.options || []).map(opt => (
                      <button key={opt} type="button" disabled={isSubmitted}
                        onClick={() => setQAnswers(prev => ({ ...prev, [field.id]: opt }))}
                        className={cn('rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                          qAnswers[field.id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-foreground hover:bg-muted')}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : field.field_type === 'number' ? (
                  <Input type="number" value={qAnswers[field.id] || ''} disabled={isSubmitted}
                    onChange={e => setQAnswers(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder="Sua resposta..." />
                ) : (
                  <Input value={qAnswers[field.id] || ''} disabled={isSubmitted}
                    onChange={e => setQAnswers(prev => ({ ...prev, [field.id]: e.target.value }))} placeholder="Sua resposta..." />
                )}
              </SectionCard>
            ))}
          </div>

          {!isSubmitted && (
            <Button className="w-full gap-1.5" onClick={handleSubmitQuestionnaire} disabled={savingQ}>
              {savingQ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar respostas
            </Button>
          )}
        </div>
      </PortalLayout>
    );
  }

  // Intake form view
  if (activeView === 'intake') {
    return (
      <PortalLayout>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setActiveView('list')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Ficha de Anamnese</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Preencha seus dados para seu terapeuta</p>
            </div>
          </div>

          {submitted && (
            <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-xl px-4 py-3 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Ficha enviada ao terapeuta. Você ainda pode atualizar seus dados.</span>
            </div>
          )}

        {/* Dados Pessoais */}
        <SectionCard title="Dados Pessoais (Paciente)">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Nome completo *">
              <Input value={form.full_name} onChange={set('full_name')} placeholder="Seu nome completo" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <Input value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
              </Field>
              <Field label="Data de nascimento">
                <Input type="date" value={form.birthdate} onChange={set('birthdate')} />
              </Field>
            </div>
            <Field label="Sexo">
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gender: opt.value }))}
                    className={cn(
                      'rounded-xl border py-2 text-xs font-medium transition-colors',
                      form.gender === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone">
                <Input value={form.phone} onChange={set('phone')} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="WhatsApp">
                <Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(00) 00000-0000" />
              </Field>
            </div>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={set('email')} placeholder="seu@email.com" />
            </Field>
            <Field label="Endereço">
              <Input value={form.address} onChange={set('address')} placeholder="Rua, número, cidade" />
            </Field>
            <Field label="Como conheceu o profissional?">
              <Input value={form.how_found} onChange={set('how_found')} placeholder="Ex: Instagram, Indicação, Google..." />
            </Field>
          </div>
        </SectionCard>

        {/* Contato de Emergência */}
        <SectionCard title="Contato de Emergência">
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <Input value={form.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder="Nome completo" />
              </Field>
              <Field label="Parentesco">
                <Input value={form.emergency_contact_relation} onChange={set('emergency_contact_relation')} placeholder="Ex: Pai, Mãe, Cônjuge" />
              </Field>
            </div>
            <Field label="Telefone">
              <Input value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="Endereço">
              <Input value={form.emergency_contact_address} onChange={set('emergency_contact_address')} placeholder="Endereço do contato" />
            </Field>
          </div>
        </SectionCard>

        {/* Responsável (menor de idade) */}
        <SectionCard title="Responsável Legal (Contratante)">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Nome do responsável">
              <Input value={form.responsible_name} onChange={set('responsible_name')} placeholder="Nome completo" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF do responsável">
                <Input value={form.responsible_cpf} onChange={set('responsible_cpf')} placeholder="000.000.000-00" />
              </Field>
              <Field label="Telefone do responsável">
                <Input value={form.responsible_phone} onChange={set('responsible_phone')} placeholder="(00) 00000-0000" />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Responsável Financeiro */}
        <SectionCard title="Responsável Financeiro">
          <p className="text-xs text-muted-foreground -mt-1">Deixe em branco se for o próprio paciente</p>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Nome">
              <Input value={form.financial_responsible_name} onChange={set('financial_responsible_name')} placeholder="Nome completo" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF">
                <Input value={form.financial_responsible_cpf} onChange={set('financial_responsible_cpf')} placeholder="000.000.000-00" />
              </Field>
              <Field label="Parentesco">
                <Input value={form.financial_responsible_relation} onChange={set('financial_responsible_relation')} placeholder="Ex: Pai, Mãe" />
              </Field>
            </div>
            <Field label="E-mail">
              <Input type="email" value={form.financial_responsible_email} onChange={set('financial_responsible_email')} placeholder="email@exemplo.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone/WhatsApp">
                <Input value={form.financial_responsible_phone} onChange={set('financial_responsible_phone')} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="Endereço">
                <Input value={form.financial_responsible_address} onChange={set('financial_responsible_address')} placeholder="Rua, número, cidade" />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Melhor dia para pagamento */}
        <SectionCard title="Melhor dia para pagamento">
          <p className="text-xs text-muted-foreground -mt-1">Informe o dia do mês que prefere realizar o pagamento</p>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setCustomDay(false); setForm(f => ({ ...f, payment_due_day: opt.value })); }}
                className={cn(
                  'rounded-xl border py-2 text-sm font-semibold transition-colors',
                  form.payment_due_day === opt.value && !customDay
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setCustomDay(true); setForm(f => ({ ...f, payment_due_day: '' })); }}
            className={cn(
              'w-full rounded-xl border py-2 text-sm font-medium transition-colors',
              customDay
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/50 border-border text-foreground hover:bg-muted'
            )}
          >
            Outro dia
          </button>
          {customDay && (
            <Field label="Dia personalizado (1-31)">
              <Input type="number" min={1} max={31} value={form.payment_due_day} onChange={set('payment_due_day')} placeholder="Ex: 25" />
            </Field>
          )}
        </SectionCard>

        {/* Informações de Saúde */}
        <SectionCard title="Informações de Saúde">
          <Field label="Informações médicas relevantes (diagnósticos, medicamentos, alergias)">
            <Textarea value={form.health_info} onChange={set('health_info')} placeholder="Ex: uso de medicação, diagnósticos anteriores..." className="resize-none" rows={3} />
          </Field>
          <Field label="Observações adicionais">
            <Textarea value={form.observations} onChange={set('observations')} placeholder="Algo mais que queira compartilhar com seu terapeuta..." className="resize-none" rows={3} />
          </Field>
        </SectionCard>

        {/* Perguntas Personalizadas do Terapeuta */}
        {customQuestions.length > 0 && (
          <SectionCard title="Perguntas do Terapeuta">
            <div className="space-y-4">
              {customQuestions.map(q => (
                <CustomQuestionField
                  key={q.id}
                  question={q}
                  value={customAnswers[q.id] || ''}
                  onChange={val => setAnswer(q.id, val)}
                />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Actions */}
        <div className="flex gap-2 pb-4">
          <Button variant="outline" className="flex-1" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Salvar rascunho
          </Button>
          <Button className="flex-1" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {submitted ? 'Atualizar ficha' : 'Enviar ao terapeuta'}
          </Button>
        </div>
      </div>
    </PortalLayout>
    );
  }

  // List view (default)
  const pendingQ = questionnaires.filter(q => q.status === 'pending');
  const doneQ = questionnaires.filter(q => q.status !== 'pending');

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Minhas Fichas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Fichas e questionários do seu terapeuta</p>
        </div>

        {/* Ficha de Anamnese - always first */}
        <button
          onClick={() => setActiveView('intake')}
          className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ficha de Anamnese</p>
                <p className="text-xs text-muted-foreground">Dados cadastrais e clínicos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {submitted ? (
                <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Enviada
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Pendente</Badge>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </button>

        {/* Pending questionnaires */}
        {pendingQ.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pendentes</h2>
            {pendingQ.map(q => (
              <button
                key={q.id}
                onClick={() => openQuestionnaire(q)}
                className="w-full rounded-xl border border-warning/30 bg-warning/5 p-4 text-left hover:bg-warning/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{q.title}</p>
                      <p className="text-xs text-muted-foreground">{q.fields.length} perguntas • Recebido em {format(new Date(q.created_at), "d/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Preencher</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Completed questionnaires */}
        {doneQ.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preenchidos</h2>
            {doneQ.map(q => (
              <button
                key={q.id}
                onClick={() => openQuestionnaire(q)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado em {q.submitted_at ? format(new Date(q.submitted_at), "d/MM/yyyy", { locale: ptBR }) : '—'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}

        {questionnaires.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum questionário adicional recebido.</p>
        )}
      </div>
    </PortalLayout>
  );
}
