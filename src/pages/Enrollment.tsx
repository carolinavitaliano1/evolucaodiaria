import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  CheckCircle2, Loader2, Building2, AlertTriangle, ClipboardList, User, Users,
} from 'lucide-react';

type FinancialResponsible = 'patient' | 'responsible' | 'other';

const GUARDIAN_KINSHIP_OPTIONS = ['Mãe','Pai','Avó','Avô','Tia','Tio','Responsável Legal','Outro'];

interface FormState {
  name: string; birthdate: string; cpf: string; phone: string; whatsapp: string; email: string;
  is_minor: boolean;
  guardian_name: string; guardian_email: string; guardian_phone: string; guardian_kinship: string;
  responsible_name: string; responsible_cpf: string; responsible_whatsapp: string;
  responsible_email: string; responsible_relation: string;
  financial_responsible: FinancialResponsible;
  financial_responsible_name: string; financial_responsible_cpf: string; financial_responsible_whatsapp: string; financial_responsible_email: string;
  diagnosis: string; observations: string;
}

const empty: FormState = {
  name: '', birthdate: '', cpf: '', phone: '', whatsapp: '', email: '',
  is_minor: true,
  guardian_name: '', guardian_email: '', guardian_phone: '', guardian_kinship: '',
  responsible_name: '', responsible_cpf: '', responsible_whatsapp: '', responsible_email: '', responsible_relation: '',
  financial_responsible: 'responsible',
  financial_responsible_name: '', financial_responsible_cpf: '', financial_responsible_whatsapp: '', financial_responsible_email: '',
  diagnosis: '', observations: '',
};

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ id, label, required, children }: { id?: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}{required && ' *'}</Label>
      {children}
    </div>
  );
}

export default function Enrollment() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinic, setClinic] = useState<{ name: string; address: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (!clinicId) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('clinics')
      .select('name, address')
      .eq('id', clinicId)
      .neq('is_archived', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setClinic(data);
        setLoading(false);
      });
  }, [clinicId]);

  const maskCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  const maskPhone = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const setMasked = (field: keyof FormState, mask: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: mask(e.target.value) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.birthdate) {
      toast.error('Preencha o nome e a data de nascimento do paciente');
      return;
    }
    if (form.is_minor && !form.guardian_name.trim()) {
      toast.error('Preencha o nome do responsável (paciente menor de idade)');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-enrollment', {
        body: { clinic_id: clinicId, ...form },
      });
      if (error) throw new Error(error.message || 'Erro ao enviar ficha');
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link de cadastro não existe ou foi desativado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-background p-6 text-center">
        <div className="max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Ficha enviada com sucesso! 🎉</h1>
          <p className="text-muted-foreground leading-relaxed mb-6">
            A clínica <strong className="text-foreground">{clinic?.name}</strong> entrará em contato em breve.
          </p>
          <p className="text-xs text-muted-foreground mb-8">Seus dados são tratados com total sigilo e privacidade. 🔒</p>
          <Button variant="outline" className="w-full" onClick={() => window.close()}>Fechar esta página</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{clinic?.name}</h1>
          {clinic?.address && <p className="text-sm text-muted-foreground mt-1">{clinic.address}</p>}
          <p className="text-muted-foreground mt-3 text-sm">Preencha os dados abaixo para enviar sua ficha de cadastro.</p>
        </div>

        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Ficha de Cadastro</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Toggle menor de idade */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div>
                <p className="text-sm font-semibold text-foreground">Paciente é menor de idade?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.is_minor
                    ? 'Seção do responsável será obrigatória'
                    : 'As comunicações irão diretamente ao paciente'}
                </p>
              </div>
              <Switch
                checked={form.is_minor}
                onCheckedChange={(v) => setForm(f => ({ ...f, is_minor: v, financial_responsible: v ? 'responsible' : 'patient' }))}
              />
            </div>

            {/* 1. Dados do Paciente */}
            <SectionCard icon={<User className="w-4 h-4" />} title="Dados do Paciente">
              <Field id="name" label="Nome Completo" required>
                <Input id="name" value={form.name} onChange={set('name')} placeholder="Ex: João Pedro Silva" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="birthdate" label="Data de Nascimento" required>
                  <Input id="birthdate" type="date" value={form.birthdate} onChange={set('birthdate')} required />
                </Field>
                <Field id="cpf" label="CPF">
                  <Input id="cpf" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="phone" label="Telefone">
                  <Input id="phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(11) 3333-3333" />
                </Field>
                <Field id="whatsapp" label="WhatsApp">
                  <Input id="whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999" />
                </Field>
              </div>
              <Field id="email_patient" label="E-mail">
                <Input id="email_patient" type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
              </Field>
            </SectionCard>

            {/* 2. Dados do Responsável Legal (obrigatório para menores) */}
            {form.is_minor && (
              <SectionCard icon={<Users className="w-4 h-4" />} title="Dados do Responsável Legal *">
                <p className="text-xs text-muted-foreground -mt-1">Responsável principal — todas as comunicações serão direcionadas a esta pessoa.</p>
                <Field id="guardian_name" label="Nome do Responsável" required>
                  <Input id="guardian_name" value={form.guardian_name} onChange={set('guardian_name')} placeholder="Ex: Maria Silva" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="guardian_kinship" label="Parentesco">
                    <select
                      id="guardian_kinship"
                      value={form.guardian_kinship}
                      onChange={set('guardian_kinship')}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Selecione...</option>
                      {GUARDIAN_KINSHIP_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </Field>
                  <Field id="guardian_phone" label="WhatsApp">
                    <Input id="guardian_phone" type="tel" value={form.guardian_phone} onChange={set('guardian_phone')} placeholder="(11) 99999-9999" />
                  </Field>
                </div>
                <Field id="guardian_email" label="E-mail">
                  <Input id="guardian_email" type="email" value={form.guardian_email} onChange={set('guardian_email')} placeholder="email@exemplo.com" />
                </Field>

                {/* Toggle: responsável legal é o financeiro? */}
                <div className="rounded-xl border border-primary/30 bg-background/60 p-3 space-y-3 mt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Responsável legal é também o financeiro?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.financial_responsible === 'responsible'
                          ? 'Sim — usará os dados acima para cobrança'
                          : 'Não — preencha os dados do responsável financeiro abaixo'}
                      </p>
                    </div>
                    <div
                      className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${form.financial_responsible === 'responsible' ? 'bg-primary' : 'bg-input'}`}
                      onClick={() => setForm(f => ({ ...f, financial_responsible: f.financial_responsible === 'responsible' ? 'other' : 'responsible' }))}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.financial_responsible === 'responsible' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>

                  {form.financial_responsible === 'other' && (
                    <div className="space-y-3 pt-1 border-t border-border">
                      <p className="text-xs font-semibold text-foreground">Responsável Financeiro</p>
                      <Field id="fin_name" label="Nome">
                        <Input id="fin_name" value={form.financial_responsible_name} onChange={set('financial_responsible_name')} placeholder="Nome completo" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field id="fin_cpf" label="CPF">
                          <Input id="fin_cpf" value={form.financial_responsible_cpf} onChange={set('financial_responsible_cpf')} placeholder="000.000.000-00" />
                        </Field>
                        <Field id="fin_whatsapp" label="WhatsApp">
                          <Input id="fin_whatsapp" type="tel" value={form.financial_responsible_whatsapp} onChange={set('financial_responsible_whatsapp')} placeholder="(11) 99999-9999" />
                        </Field>
                      </div>
                      <Field id="fin_email" label="E-mail">
                        <Input id="fin_email" type="email" value={form.financial_responsible_email} onChange={set('financial_responsible_email')} placeholder="email@exemplo.com" />
                      </Field>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* 3. Responsável Financeiro — só aparece se NÃO for menor */}
            {!form.is_minor && (
              <SectionCard icon={<Users className="w-4 h-4" />} title="Responsável Financeiro">
                <p className="text-xs text-muted-foreground -mt-1">Dados jurídicos para contrato.</p>

                {/* Toggle: paciente é o responsável financeiro? */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Paciente será o responsável financeiro?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {form.financial_responsible === 'patient'
                          ? 'Sim — os dados do paciente serão usados para cobrança'
                          : 'Não — preencha os dados do responsável financeiro abaixo'}
                      </p>
                    </div>
                    <div
                      className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${form.financial_responsible === 'patient' ? 'bg-primary' : 'bg-input'}`}
                      onClick={() => setForm(f => ({ ...f, financial_responsible: f.financial_responsible === 'patient' ? 'other' : 'patient' }))}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.financial_responsible === 'patient' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>

                  {form.financial_responsible !== 'patient' && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <Field id="fin_name2" label="Nome do Responsável Financeiro">
                        <Input id="fin_name2" value={form.financial_responsible_name} onChange={set('financial_responsible_name')} placeholder="Nome completo" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field id="fin_cpf2" label="CPF">
                          <Input id="fin_cpf2" value={form.financial_responsible_cpf} onChange={set('financial_responsible_cpf')} placeholder="000.000.000-00" />
                        </Field>
                        <Field id="fin_whatsapp2" label="WhatsApp">
                          <Input id="fin_whatsapp2" type="tel" value={form.financial_responsible_whatsapp} onChange={set('financial_responsible_whatsapp')} placeholder="(11) 99999-9999" />
                        </Field>
                      </div>
                      <Field id="fin_email2" label="E-mail">
                        <Input id="fin_email2" type="email" value={form.financial_responsible_email} onChange={set('financial_responsible_email')} placeholder="email@exemplo.com" />
                      </Field>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* 5. Informações Clínicas */}
            <SectionCard icon={<ClipboardList className="w-4 h-4" />} title="Informações Clínicas">
              <Field id="diagnosis" label="Diagnóstico (se houver)">
                <Input id="diagnosis" value={form.diagnosis} onChange={set('diagnosis')} placeholder="Ex: TEA, TDAH, Ansiedade..." />
              </Field>
              <Field id="observations" label="Motivo da Consulta / Observações">
                <textarea
                  id="observations"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={3}
                  value={form.observations}
                  onChange={set('observations')}
                  placeholder="Descreva brevemente o motivo da consulta..."
                />
              </Field>
            </SectionCard>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando ficha...</>
                : 'Enviar Ficha de Cadastro'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
          Seus dados são tratados com total sigilo e privacidade. 🔒
        </p>
      </div>
    </div>
  );
}
