import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Phone, Mail, User, Loader2, Calendar, DollarSign, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '@/contexts/AppContext';

interface PendingPatient {
  id: string;
  name: string;
  birthdate: string;
  responsible_name: string | null;
  responsible_whatsapp: string | null;
  whatsapp: string | null;
  email: string | null;
  observations: string | null;
  created_at: string;
}

interface Props {
  clinicId: string;
  pendingPatients: PendingPatient[];
  onActivated: (patientId: string) => void;
}

interface FinalizeForm {
  weekdays: string[];
  scheduleTime: string;
  paymentValue: string;
  paymentType: 'sessao' | 'fixo';
  contractStartDate: string;
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function PendingEnrollmentsPanel({ clinicId, pendingPatients, onActivated }: Props) {
  const { user } = useAuth();
  const { updatePatient } = useApp();
  const [selectedPatient, setSelectedPatient] = useState<PendingPatient | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FinalizeForm>({
    weekdays: [],
    scheduleTime: '',
    paymentValue: '',
    paymentType: 'sessao',
    contractStartDate: '',
  });

  if (pendingPatients.length === 0) return null;

  const openFinalize = (p: PendingPatient) => {
    setSelectedPatient(p);
    setForm({ weekdays: [], scheduleTime: '', paymentValue: '', paymentType: 'sessao', contractStartDate: '' });
  };

  const toggleWeekday = (day: string) => {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(day) ? f.weekdays.filter(d => d !== day) : [...f.weekdays, day],
    }));
  };

  const handleActivate = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        status: 'ativo',
        weekdays: form.weekdays.length > 0 ? form.weekdays : null,
        schedule_time: form.scheduleTime || null,
        payment_value: form.paymentValue ? parseFloat(form.paymentValue) : null,
        payment_type: form.paymentType,
        contract_start_date: form.contractStartDate || null,
      };

      const { error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', selectedPatient.id);

      if (error) throw error;

      toast.success(`${selectedPatient.name} ativado com sucesso! 🎉`);
      setSelectedPatient(null);
      onActivated(selectedPatient.id);
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
    onActivated(patientId);
  };

  return (
    <>
      <div className="mb-6 rounded-2xl border-2 border-warning/40 bg-warning/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-warning" />
          <h3 className="font-bold text-foreground">
            Novos Cadastros Pendentes
          </h3>
          <Badge className="bg-warning text-warning-foreground text-xs">{pendingPatients.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Estes pacientes preencheram a ficha de matrícula online e aguardam sua revisão para serem ativados.
        </p>
        <div className="space-y-2">
          {pendingPatients.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 bg-card rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {p.responsible_name && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />{p.responsible_name}
                    </span>
                  )}
                  {(p.responsible_whatsapp || p.whatsapp) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />{p.responsible_whatsapp || p.whatsapp}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "d 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleReject(p.id, p.name)}
                  title="Remover ficha"
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  className="gradient-primary gap-1 h-8 text-xs"
                  onClick={() => openFinalize(p)}
                >
                  Revisar
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
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
              <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados enviados pela família</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Paciente</span>
                    <p className="font-medium text-foreground">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nascimento</span>
                    <p className="font-medium text-foreground">
                      {format(new Date(selectedPatient.birthdate + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  {selectedPatient.responsible_name && (
                    <div>
                      <span className="text-muted-foreground text-xs">Responsável</span>
                      <p className="font-medium text-foreground">{selectedPatient.responsible_name}</p>
                    </div>
                  )}
                  {(selectedPatient.responsible_whatsapp || selectedPatient.whatsapp) && (
                    <div>
                      <span className="text-muted-foreground text-xs">WhatsApp</span>
                      <p className="font-medium text-foreground">{selectedPatient.responsible_whatsapp || selectedPatient.whatsapp}</p>
                    </div>
                  )}
                  {selectedPatient.email && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">E-mail</span>
                      <p className="font-medium text-foreground">{selectedPatient.email}</p>
                    </div>
                  )}
                  {selectedPatient.observations && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Motivo da Consulta</span>
                      <p className="font-medium text-foreground text-sm leading-snug">{selectedPatient.observations}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical info to fill */}
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
                  <Label htmlFor="scheduleTime">Horário da Sessão</Label>
                  <Input
                    id="scheduleTime"
                    type="time"
                    value={form.scheduleTime}
                    onChange={(e) => setForm(f => ({ ...f, scheduleTime: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="paymentValue" className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />Valor da Sessão
                    </Label>
                    <Input
                      id="paymentValue"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.paymentValue}
                      onChange={(e) => setForm(f => ({ ...f, paymentValue: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label>Tipo de Cobrança</Label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.paymentType}
                      onChange={(e) => setForm(f => ({ ...f, paymentType: e.target.value as 'sessao' | 'fixo' }))}
                    >
                      <option value="sessao">Por Sessão</option>
                      <option value="fixo">Fixo Mensal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="contractStartDate">Data de Início do Contrato</Label>
                  <Input
                    id="contractStartDate"
                    type="date"
                    value={form.contractStartDate}
                    onChange={(e) => setForm(f => ({ ...f, contractStartDate: e.target.value }))}
                  />
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
