import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Patient } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Package, Sparkles, Edit3, Check, X, Calendar as CalendarIcon, ShieldCheck, Stethoscope, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PatientPlanCardProps {
  patient: Patient;
  canEdit: boolean;
}

export function PatientPlanCard({ patient, canEdit }: PatientPlanCardProps) {
  const { getClinicPackages, updatePatient, evolutions } = useApp();
  const navigate = useNavigate();
  const { user } = useAuth();

  const clinicPackages = getClinicPackages(patient.clinicId).filter(p => p.isActive);
  const currentPackage = clinicPackages.find(p => p.id === patient.packageId);

  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<'sessao' | 'fixo'>(patient.paymentType || 'sessao');
  const [paymentValue, setPaymentValue] = useState((patient.paymentValue || 0).toString());
  const [paymentDueDay, setPaymentDueDay] = useState(((patient as any).payment_due_day || '').toString());

  // Health plans (convênios) for this clinic
  const [healthPlans, setHealthPlans] = useState<Array<{ id: string; name: string; reimbursement_value: number | null; reimbursement_type: string | null }>>([]);
  const patientHealthPlanId = (patient as any).health_plan_id as string | null | undefined;
  const cardNumber = (patient as any).health_plan_card_number as string | null | undefined;
  const authorizedSessions = (patient as any).health_plan_authorized_sessions as number | null | undefined;
  const authExpires = (patient as any).health_plan_authorization_expires_at as string | null | undefined;
  const currentHealthPlan = healthPlans.find(h => h.id === patientHealthPlanId);

  // Active session plan (treatment plan)
  const [activePlan, setActivePlan] = useState<{ id: string; title: string; objectives: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('health_plans')
        .select('id, name, reimbursement_value, reimbursement_type')
        .eq('clinic_id', patient.clinicId)
        .eq('is_active', true)
        .order('name');
      if (!cancelled && data) setHealthPlans(data as any);
    })();
    return () => { cancelled = true; };
  }, [patient.clinicId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('session_plans')
        .select('id, title, objectives, status, created_at')
        .eq('patient_id', patient.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (cancelled || !data) return;
      const filtered = (data as any[]).filter(p => !p.objectives?.includes('[grupo:'));
      const active = filtered.find(p => p.status === 'active' || p.status === 'in_progress') || filtered[0] || null;
      setActivePlan(active);
    })();
  }, [patient.id, user]);

  // Sessions this month for the package progress
  const sessionsThisMonth = useMemo(() => {
    const now = new Date();
    return evolutions.filter(e => {
      if (e.patientId !== patient.id) return false;
      const d = new Date(e.date + 'T00:00:00');
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear() &&
             (e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao');
    }).length;
  }, [evolutions, patient.id]);

  const handleSavePayment = async () => {
    const val = parseFloat(paymentValue) || 0;
    const dueDay = paymentDueDay ? parseInt(paymentDueDay) : undefined;
    try {
      await updatePatient(patient.id, {
        paymentType,
        paymentValue: val,
        ...(dueDay ? { payment_due_day: dueDay } as any : { payment_due_day: null } as any),
      });
      toast.success('Plano de pagamento atualizado');
      setEditingPayment(false);
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const handleChangePackage = async (newPkgId: string) => {
    const value = newPkgId === 'none' ? null : newPkgId;
    try {
      await updatePatient(patient.id, { packageId: value as any });
      toast.success(value ? 'Pacote vinculado' : 'Pacote removido');
    } catch {
      toast.error('Erro ao atualizar pacote');
    }
  };

  const handleChangeHealthPlan = async (newId: string) => {
    const value = newId === 'none' ? null : newId;
    const { error } = await supabase
      .from('patients')
      .update(value
        ? { health_plan_id: value }
        : { health_plan_id: null, health_plan_card_number: null, health_plan_authorized_sessions: null, health_plan_authorization_expires_at: null })
      .eq('id', patient.id);
    if (error) { toast.error('Erro ao atualizar convênio'); return; }
    toast.success(value ? 'Convênio vinculado' : 'Convênio removido');
    // Optimistic local mutation
    (patient as any).health_plan_id = value;
    if (!value) {
      (patient as any).health_plan_card_number = null;
      (patient as any).health_plan_authorized_sessions = null;
      (patient as any).health_plan_authorization_expires_at = null;
    }
  };

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary" /> Plano & Financeiro
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Plano de pagamento */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-success" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Plano de pagamento</p>
            </div>
            {canEdit && !editingPayment && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingPayment(true)}>
                <Edit3 className="w-3 h-3" />
              </Button>
            )}
          </div>

          {!editingPayment ? (
            <div className="space-y-1.5">
              <p className="text-lg font-bold text-foreground">
                {patient.paymentValue
                  ? `R$ ${patient.paymentValue.toFixed(2)}`
                  : <span className="text-sm text-muted-foreground">Não configurado</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {patient.paymentType === 'fixo' ? 'Mensal fixo' : 'Por sessão'}
              </p>
              {(patient as any).payment_due_day && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                  <CalendarIcon className="w-3 h-3" /> Vence dia <strong>{(patient as any).payment_due_day}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px]">Tipo</Label>
                <Select value={paymentType} onValueChange={(v) => setPaymentType(v as 'sessao' | 'fixo')}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sessao">Por Sessão</SelectItem>
                    <SelectItem value="fixo">Mensal Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Valor (R$)</Label>
                <Input type="number" step="0.01" value={paymentValue} onChange={e => setPaymentValue(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Dia de vencimento</Label>
                <Input type="number" min={1} max={31} value={paymentDueDay} onChange={e => setPaymentDueDay(e.target.value)} placeholder="Ex: 10" className="h-8 text-xs" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="outline" className="h-7 flex-1 gap-1" onClick={() => { setEditingPayment(false); setPaymentType(patient.paymentType || 'sessao'); setPaymentValue((patient.paymentValue || 0).toString()); }}>
                  <X className="w-3 h-3" /> Cancelar
                </Button>
                <Button size="sm" className="h-7 flex-1 gap-1" onClick={handleSavePayment}>
                  <Check className="w-3 h-3" /> Salvar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Pacote contratado */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Package className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Pacote contratado</p>
          </div>

          {canEdit ? (
            <Select value={patient.packageId || 'none'} onValueChange={handleChangePackage}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sem pacote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem pacote</SelectItem>
                {clinicPackages.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — R$ {pkg.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-foreground font-medium">{currentPackage?.name || 'Sem pacote'}</p>
          )}

          {currentPackage && (
            <div className="mt-3 space-y-1.5">
              <p className="text-lg font-bold text-success">R$ {currentPackage.price.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">
                {currentPackage.packageType === 'por_sessao' ? 'Por sessão' :
                 currentPackage.packageType === 'personalizado' ? `${currentPackage.sessionLimit || 0} sessões` :
                 'Mensal'}
              </p>
              {currentPackage.packageType === 'personalizado' && currentPackage.sessionLimit && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Progresso do mês</span>
                    <span className="font-semibold text-foreground">{sessionsThisMonth} / {currentPackage.sessionLimit}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (sessionsThisMonth / currentPackage.sessionLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {!currentPackage && clinicPackages.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic mt-2">
              Nenhum pacote ativo cadastrado nesta clínica.
            </p>
          )}
        </div>

        {/* Plano de saúde (Convênio) */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Plano de saúde</p>
          </div>

          {canEdit ? (
            <Select value={patientHealthPlanId || 'none'} onValueChange={handleChangeHealthPlan}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sem convênio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Particular / Sem convênio</SelectItem>
                {healthPlans.map(hp => (
                  <SelectItem key={hp.id} value={hp.id}>{hp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-foreground font-medium">{currentHealthPlan?.name || 'Particular'}</p>
          )}

          {currentHealthPlan && (
            <div className="mt-3 space-y-1.5">
              {currentHealthPlan.reimbursement_value != null && currentHealthPlan.reimbursement_value > 0 && (
                <p className="text-sm font-semibold text-foreground">
                  Reembolso: R$ {Number(currentHealthPlan.reimbursement_value).toFixed(2)}
                  <span className="text-[11px] text-muted-foreground font-normal ml-1">
                    {currentHealthPlan.reimbursement_type === 'mensal' ? '/ mês' : '/ sessão'}
                  </span>
                </p>
              )}
              {cardNumber && (
                <p className="text-[11px] text-muted-foreground">Carteirinha: <strong className="text-foreground">{cardNumber}</strong></p>
              )}
              {authorizedSessions != null && (
                <p className="text-[11px] text-muted-foreground">Sessões autorizadas: <strong className="text-foreground">{authorizedSessions}</strong></p>
              )}
              {authExpires && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" /> Validade: <strong className="text-foreground">{new Date(authExpires + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                </p>
              )}
            </div>
          )}

          {!currentHealthPlan && healthPlans.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic mt-2">
              Nenhum convênio cadastrado nesta clínica.
            </p>
          )}
        </div>

        {/* Plano de tratamento ativo */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Plano de tratamento ativo</p>
            </div>
          </div>

          {activePlan ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground line-clamp-2">{activePlan.title || 'Plano sem título'}</p>
              {activePlan.objectives && (
                <p className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-line">{activePlan.objectives}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-primary"
                onClick={() => navigate(`/patients/${patient.id}#session`)}
              >
                Abrir processo terapêutico <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground italic">
                Nenhum plano de tratamento criado ainda.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full text-xs gap-1"
                onClick={() => navigate(`/patients/${patient.id}#session`)}
              >
                <Sparkles className="w-3 h-3" /> Criar plano de tratamento
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}