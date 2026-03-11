import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntakeForm {
  full_name: string;
  cpf: string;
  birthdate: string;
  phone: string;
  address: string;
  responsible_name: string;
  responsible_cpf: string;
  responsible_phone: string;
  emergency_contact: string;
  health_info: string;
  observations: string;
  payment_due_day: string; // stored as string for input, converted to int on save
}

const empty: IntakeForm = {
  full_name: '', cpf: '', birthdate: '', phone: '', address: '',
  responsible_name: '', responsible_cpf: '', responsible_phone: '',
  emergency_contact: '', health_info: '', observations: '',
  payment_due_day: '',
};

const PAYMENT_DAY_OPTIONS = [
  { label: 'Dia 5', value: '5' },
  { label: 'Dia 10', value: '10' },
  { label: 'Dia 15', value: '15' },
  { label: 'Dia 20', value: '20' },
];

export default function PortalIntakeForm() {
  const { portalAccount } = usePortal();
  const [form, setForm] = useState<IntakeForm>(empty);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customDay, setCustomDay] = useState(false);

  useEffect(() => {
    if (!portalAccount) return;
    supabase
      .from('patient_intake_forms')
      .select('*')
      .eq('patient_id', portalAccount.patient_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const dayVal = (data as any).payment_due_day ? String((data as any).payment_due_day) : '';
          const isPreset = PAYMENT_DAY_OPTIONS.some(o => o.value === dayVal);
          setCustomDay(!!dayVal && !isPreset);
          setForm({
            full_name: data.full_name || '',
            cpf: data.cpf || '',
            birthdate: data.birthdate || '',
            phone: data.phone || '',
            address: data.address || '',
            responsible_name: data.responsible_name || '',
            responsible_cpf: data.responsible_cpf || '',
            responsible_phone: data.responsible_phone || '',
            emergency_contact: data.emergency_contact || '',
            health_info: data.health_info || '',
            observations: data.observations || '',
            payment_due_day: dayVal,
          });
          if (data.submitted_at) setSubmitted(true);
        }
        setLoading(false);
      });
  }, [portalAccount]);

  const set = (field: keyof IntakeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (submit = false) => {
    if (!portalAccount) return;
    setSaving(true);
    try {
      const paymentDueDay = form.payment_due_day ? parseInt(form.payment_due_day, 10) : null;
      const payload: Record<string, any> = {
        patient_id: portalAccount.patient_id,
        therapist_user_id: portalAccount.therapist_user_id,
        ...form,
        birthdate: form.birthdate || null,
        payment_due_day: paymentDueDay,
        updated_at: new Date().toISOString(),
      };
      if (submit) payload.submitted_at = new Date().toISOString();

      const { error } = await supabase
        .from('patient_intake_forms')
        .upsert(payload, { onConflict: 'patient_id' });
      if (error) throw error;

      // On submit: sync ALL key fields back to the patient record
      if (submit) {
        const patientUpdate: Record<string, any> = {};
        if (form.phone) patientUpdate.phone = form.phone;
        if (form.cpf) patientUpdate.cpf = form.cpf;
        if (form.birthdate) patientUpdate.birthdate = form.birthdate;
        if (form.responsible_name) patientUpdate.responsible_name = form.responsible_name;
        if (form.responsible_cpf) patientUpdate.responsible_cpf = form.responsible_cpf;
        if (form.responsible_phone) patientUpdate.responsible_whatsapp = form.responsible_phone;
        if (form.observations) patientUpdate.observations = form.observations;
        if (paymentDueDay) patientUpdate.payment_due_day = paymentDueDay;

        if (Object.keys(patientUpdate).length > 0) {
          await supabase
            .from('patients')
            .update(patientUpdate)
            .eq('id', portalAccount.patient_id);
        }

        setSubmitted(true);
        toast.success('Ficha enviada ao terapeuta! ✅');
      } else {
        toast.success('Rascunho salvo');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </PortalLayout>
  );

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Minha Ficha</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Preencha seus dados para seu terapeuta</p>
        </div>

        {submitted && (
          <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-xl px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Ficha enviada ao terapeuta. Você ainda pode atualizar seus dados.</span>
          </div>
        )}

        {/* Personal data */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Dados Pessoais</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={form.full_name} onChange={set('full_name')} placeholder="Seu nome completo" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CPF</Label>
                <Input value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={form.birthdate} onChange={set('birthdate')} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.phone} onChange={set('phone')} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Contato de emergência</Label>
                <Input value={form.emergency_contact} onChange={set('emergency_contact')} placeholder="Nome e telefone" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={form.address} onChange={set('address')} placeholder="Rua, número, cidade" className="mt-1" />
            </div>
          </div>
        </div>

        {/* Responsible */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Responsável (se menor de idade)</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs">Nome do responsável</Label>
              <Input value={form.responsible_name} onChange={set('responsible_name')} placeholder="Nome completo" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CPF do responsável</Label>
                <Input value={form.responsible_cpf} onChange={set('responsible_cpf')} placeholder="000.000.000-00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Telefone do responsável</Label>
                <Input value={form.responsible_phone} onChange={set('responsible_phone')} placeholder="(00) 00000-0000" className="mt-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Payment due day */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Melhor dia para pagamento</h2>
          <p className="text-xs text-muted-foreground">Informe o dia do mês que prefere realizar o pagamento</p>
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
            <div>
              <Label className="text-xs">Dia personalizado (1-31)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.payment_due_day}
                onChange={set('payment_due_day')}
                placeholder="Ex: 25"
                className="mt-1"
              />
            </div>
          )}
        </div>

        {/* Health info */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Informações de Saúde</h2>
          <div>
            <Label className="text-xs">Informações médicas relevantes (diagnósticos, medicamentos, alergias)</Label>
            <Textarea value={form.health_info} onChange={set('health_info')} placeholder="Ex: uso de medicação, diagnósticos anteriores..." className="mt-1 resize-none" rows={3} />
          </div>
          <div>
            <Label className="text-xs">Observações adicionais</Label>
            <Textarea value={form.observations} onChange={set('observations')} placeholder="Algo mais que queira compartilhar com seu terapeuta..." className="mt-1 resize-none" rows={3} />
          </div>
        </div>

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
