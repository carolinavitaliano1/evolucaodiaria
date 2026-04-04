import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ClipboardList, ArrowRight, CheckCircle2, Clock, X, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingPatient {
  id: string;
  name: string;
  birthdate: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  clinic_id: string;
  clinic_name: string;
  responsible_name: string | null;
  responsible_cpf: string | null;
  responsible_whatsapp: string | null;
  responsible_email: string | null;
  responsible_is_financial: boolean | null;
  financial_responsible_name: string | null;
  financial_responsible_cpf: string | null;
  financial_responsible_whatsapp: string | null;
  professionals: string | null;
  diagnosis: string | null;
  observations: string | null;
  created_at: string;
}

interface FinalizeForm {
  weekdays: string[];
  scheduleTime: string;
  paymentValue: string;
  paymentType: string;
  packageId: string | null;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function PendingEnrollmentsCard() {
  const { user } = useAuth();
  const { clinicPackages } = useApp();
  const [pending, setPending] = useState<PendingPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PendingPatient | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FinalizeForm>({
    weekdays: [],
    scheduleTime: '',
    paymentValue: '',
    paymentType: 'sessao',
    packageId: null,
  });

  const fetchPending = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .select('id, name, birthdate, cpf, phone, whatsapp, email, clinic_id, responsible_name, responsible_cpf, responsible_whatsapp, responsible_email, responsible_is_financial, financial_responsible_name, financial_responsible_cpf, financial_responsible_whatsapp, professionals, diagnosis, observations, created_at, clinics(name)')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (data) {
      setPending(
        data.map((p: any) => ({
          ...p,
          clinic_name: p.clinics?.name ?? '',
        }))
      );
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPending();

    const channel = supabase
      .channel('dashboard-pending-enrollments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `user_id=eq.${user.id}` },
        () => fetchPending()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const openFinalize = (p: PendingPatient) => {
    setSelectedPatient(p);
    setForm({ weekdays: [], scheduleTime: '', paymentValue: '', paymentType: 'sessao', packageId: null });
  };

  const toggleWeekday = (day: string) => {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter(d => d !== day) : [...f.weekdays, day],
    }));
  };

  const packages = selectedPatient
    ? clinicPackages.filter(p => p.clinicId === selectedPatient.clinic_id && p.isActive)
    : [];

  const handlePaymentTypeChange = (value: string) => {
    if (value === 'sessao' || value === 'fixo') {
      setForm(f => ({ ...f, paymentType: value, packageId: null, paymentValue: '' }));
    } else {
      const pkg = packages.find(p => p.id === value);
      setForm(f => ({
        ...f,
        paymentType: 'fixo',
        packageId: value,
        paymentValue: pkg ? String(pkg.price) : '',
      }));
    }
  };

  const handleActivate = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      // Build schedule_by_day from weekdays + scheduleTime
      const scheduleByDay: Record<string, { start: string; end: string }> = {};
      if (form.weekdays.length > 0 && form.scheduleTime) {
        for (const day of form.weekdays) {
          scheduleByDay[day] = { start: form.scheduleTime, end: '' };
        }
      }

      const updates: Record<string, any> = {
        status: 'ativo',
        weekdays: form.weekdays.length > 0 ? form.weekdays : null,
        schedule_time: form.scheduleTime || null,
        schedule_by_day: Object.keys(scheduleByDay).length > 0 ? scheduleByDay : null,
        payment_value: form.paymentValue ? parseFloat(form.paymentValue) : null,
        payment_type: form.paymentType,
        package_id: form.packageId || null,
      };

      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', selectedPatient.id);

      if (error) throw error;

      toast.success(`${selectedPatient.name} ativado com sucesso! 🎉`);
      setSelectedPatient(null);
      fetchPending();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ativar paciente');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (patientId: string, patientName: string) => {
    if (!confirm(`Deseja remover a ficha de "${patientName}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('patients').delete().eq('id', patientId);
    if (error) { toast.error('Erro ao remover ficha'); return; }
    toast.success('Ficha removida.');
    fetchPending();
  };

  const paymentSelectValue = form.packageId || form.paymentType;

  if (pending.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-semibold text-foreground">
            Matrículas Pendentes
          </h3>
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-warning/20 text-warning text-xs font-bold min-w-[20px] h-5 px-1.5">
            {pending.length}
          </span>
        </div>

        <div className="space-y-2">
          {pending.slice(0, 5).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 border border-border"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.clinic_name}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleReject(p.id, p.name)}
                  title="Remover ficha"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-xs text-primary"
                  onClick={() => openFinalize(p)}
                >
                  Revisar <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          ))}
          {pending.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              e mais {pending.length - 5} pendente{pending.length - 5 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Finalize Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={(o) => !o && setSelectedPatient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Finalizar Cadastro
            </DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-5">
              {/* Read-only submitted data */}
              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados enviados pela família</p>

                {/* Patient */}
                <div>
                  <p className="text-xs font-medium text-primary mb-2">👤 Paciente</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Nome</span>
                      <p className="font-medium text-foreground">{selectedPatient.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Nascimento</span>
                      <p className="font-medium text-foreground">
                        {format(new Date(selectedPatient.birthdate + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    {selectedPatient.cpf && (
                      <div>
                        <span className="text-muted-foreground text-xs">CPF</span>
                        <p className="font-medium text-foreground">{selectedPatient.cpf}</p>
                      </div>
                    )}
                    {selectedPatient.phone && (
                      <div>
                        <span className="text-muted-foreground text-xs">Telefone</span>
                        <p className="font-medium text-foreground">{selectedPatient.phone}</p>
                      </div>
                    )}
                    {selectedPatient.whatsapp && (
                      <div>
                        <span className="text-muted-foreground text-xs">WhatsApp</span>
                        <p className="font-medium text-foreground">{selectedPatient.whatsapp}</p>
                      </div>
                    )}
                    {selectedPatient.email && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">E-mail</span>
                        <p className="font-medium text-foreground">{selectedPatient.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Legal responsible */}
                {selectedPatient.responsible_name && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-2">👨‍👩‍👧 Responsável Legal</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">Nome</span>
                        <p className="font-medium text-foreground">{selectedPatient.responsible_name}</p>
                      </div>
                      {selectedPatient.professionals && (
                        <div>
                          <span className="text-muted-foreground text-xs">Parentesco</span>
                          <p className="font-medium text-foreground">{selectedPatient.professionals}</p>
                        </div>
                      )}
                      {selectedPatient.responsible_cpf && (
                        <div>
                          <span className="text-muted-foreground text-xs">CPF</span>
                          <p className="font-medium text-foreground">{selectedPatient.responsible_cpf}</p>
                        </div>
                      )}
                      {selectedPatient.responsible_whatsapp && (
                        <div>
                          <span className="text-muted-foreground text-xs">WhatsApp</span>
                          <p className="font-medium text-foreground">{selectedPatient.responsible_whatsapp}</p>
                        </div>
                      )}
                      {selectedPatient.responsible_email && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground text-xs">E-mail</span>
                          <p className="font-medium text-foreground">{selectedPatient.responsible_email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Financial responsible */}
                <div>
                  <p className="text-xs font-medium text-primary mb-2">💳 Responsável Financeiro</p>
                  {selectedPatient.financial_responsible_name ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">Nome</span>
                        <p className="font-medium text-foreground">{selectedPatient.financial_responsible_name}</p>
                      </div>
                      {selectedPatient.financial_responsible_cpf && (
                        <div>
                          <span className="text-muted-foreground text-xs">CPF</span>
                          <p className="font-medium text-foreground">{selectedPatient.financial_responsible_cpf}</p>
                        </div>
                      )}
                      {selectedPatient.financial_responsible_whatsapp && (
                        <div>
                          <span className="text-muted-foreground text-xs">WhatsApp</span>
                          <p className="font-medium text-foreground">{selectedPatient.financial_responsible_whatsapp}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground font-medium">
                      {selectedPatient.responsible_is_financial === false
                        ? 'O próprio paciente'
                        : selectedPatient.responsible_name
                          ? 'Responsável legal'
                          : 'O próprio paciente'}
                    </p>
                  )}
                </div>

                {/* Diagnosis */}
                {selectedPatient.diagnosis && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">🩺 Diagnóstico</p>
                    <p className="text-sm text-foreground leading-snug">{selectedPatient.diagnosis}</p>
                  </div>
                )}

                {/* Observations */}
                {selectedPatient.observations && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">📝 Motivo da Consulta</p>
                    <p className="text-sm text-foreground leading-snug">{selectedPatient.observations}</p>
                  </div>
                )}
              </div>

              {/* Contract info to fill */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações de Contrato</p>

                <div>
                  <Label className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5" />Dias da Sessão
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.weekdays.includes(day)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="dash-scheduleTime">Horário da Sessão</Label>
                  <Input
                    id="dash-scheduleTime"
                    type="time"
                    value={form.scheduleTime}
                    onChange={(e) => setForm(f => ({ ...f, scheduleTime: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>
                      <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                      Tipo de Cobrança
                    </Label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={paymentSelectValue}
                      onChange={(e) => handlePaymentTypeChange(e.target.value)}
                    >
                      <option value="sessao">Por Sessão</option>
                      <option value="fixo">Fixo Mensal</option>
                      {packages.length > 0 && (
                        <optgroup label="Pacotes">
                          {packages.map(pkg => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} — R$ {pkg.price.toFixed(2).replace('.', ',')}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="dash-paymentValue">Valor (R$)</Label>
                    <Input
                      id="dash-paymentValue"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.paymentValue}
                      onChange={(e) => setForm(f => ({ ...f, paymentValue: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedPatient(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gradient-primary gap-2"
                  onClick={handleActivate}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Ativar Paciente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
