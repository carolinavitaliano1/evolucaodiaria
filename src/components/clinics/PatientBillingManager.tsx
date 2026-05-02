import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, MessageSquare, Clock, AlertCircle, Loader2, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { calculatePatientMonthlyRevenue, EvolutionLike } from '@/utils/financialHelpers';
import type { GroupBillingMap, GroupMemberPaymentMap } from '@/utils/groupFinancial';

interface PatientBillingManagerProps {
  clinicId: string;
}

interface PaymentRecord {
  id: string;
  patient_id: string;
  amount: number;
  paid: boolean;
  due_date: string | null;
  payment_date: string | null;
  patient_name?: string;
}

export function PatientBillingManager({ clinicId }: PatientBillingManagerProps) {
  const { user } = useAuth();
  const { patients, clinics, evolutions, clinicPackages } = useApp();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refMonth, setRefMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const m = refMonth.getMonth() + 1;
  const y = refMonth.getFullYear();

  const loadPayments = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_payment_records')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('month', m)
        .eq('year', y);

      if (error) throw error;

      const clinicPatients = patients.filter(p => p.clinicId === clinicId);
      const clinic = clinics.find(c => c.id === clinicId);

      // Reference month boundaries
      const refStart = new Date(y, m - 1, 1);
      const refEnd = new Date(y, m, 0); // last day of month

      // Eligible patients: belong to this clinic, have any billing setup,
      // and were active during the reference month (started on/before month end,
      // and not departed/archived before month start)
      const eligible = clinicPatients.filter(p => {
        const hasBilling =
          (p.paymentValue && p.paymentValue > 0) || !!p.paymentType;
        if (!hasBilling) return false;

        if (p.contractStartDate) {
          const start = new Date(`${p.contractStartDate}T12:00:00`);
          if (start > refEnd) return false; // started after this month
        }

        if (p.departureDate) {
          const end = new Date(`${p.departureDate}T12:00:00`);
          if (end < refStart) return false; // left before this month
        }

        if (p.isArchived) {
          // archived without an explicit departure date: only show if a record already exists
          const hasRecord = (data || []).some(r => r.patient_id === p.id);
          if (!hasRecord) return false;
        }

        return true;
      });

      // Carrega configuração de grupos da clínica para refletir cobranças de grupo
      const groupBillingMap: GroupBillingMap = {};
      const memberPaymentMap: GroupMemberPaymentMap = {};
      try {
        const { data: groupsData } = await supabase
          .from('therapeutic_groups')
          .select('id, default_price, financial_enabled, payment_type, package_id')
          .eq('clinic_id', clinicId);
        (groupsData || []).forEach((g: any) => {
          groupBillingMap[g.id] = {
            defaultPrice: g.default_price ?? null,
            paymentType: g.payment_type ?? null,
            packageId: g.package_id ?? null,
            financialEnabled: g.financial_enabled ?? false,
          };
        });
        if ((groupsData || []).length > 0) {
          const groupIds = (groupsData || []).map((g: any) => g.id);
          const { data: membersData } = await supabase
            .from('therapeutic_group_members')
            .select('group_id, patient_id, is_paying, member_payment_value')
            .in('group_id', groupIds)
            .eq('status', 'active');
          (membersData || []).forEach((mem: any) => {
            if (!memberPaymentMap[mem.group_id]) memberPaymentMap[mem.group_id] = {};
            memberPaymentMap[mem.group_id][mem.patient_id] = {
              isPaying: mem.is_paying ?? true,
              memberPaymentValue: mem.member_payment_value ?? null,
            };
          });
        }
      } catch (e) {
        console.warn('Falha ao carregar config de grupos para cobranças', e);
      }

      // Map existing records and identify missing ones
      const records: PaymentRecord[] = eligible
        .map(p => {
          const existing = (data || []).find(r => r.patient_id === p.id);

          // Calcula valor REAL faturado no mês — respeita falta parcial,
          // pacotes, grupos e demais regras financeiras.
          let computedAmount = 0;
          if (clinic) {
            const patientEvos: EvolutionLike[] = evolutions
              .filter(e => e.patientId === p.id)
              .filter(e => {
                const d = new Date(e.date + 'T12:00:00');
                return d.getMonth() + 1 === m && d.getFullYear() === y;
              })
              .map(e => ({
                id: e.id,
                patientId: e.patientId,
                groupId: e.groupId,
                date: e.date,
                attendanceStatus: e.attendanceStatus,
                confirmedAttendance: e.confirmedAttendance,
                userId: e.userId,
              }));
            const breakdown = calculatePatientMonthlyRevenue({
              patient: p,
              clinic,
              evolutions: patientEvos,
              month: m,
              year: y,
              packages: clinicPackages || [],
              groupBillingMap,
              memberPaymentMap,
            });
            computedAmount = breakdown.total;
          }

          // Prioridade: registro salvo > valor calculado > valor fixo do paciente
          const amount = existing?.amount && existing.amount > 0
            ? existing.amount
            : (computedAmount > 0 ? computedAmount : (p.paymentValue || 0));

          return {
            id: existing?.id || `temp-${p.id}`,
            patient_id: p.id,
            amount,
            paid: existing?.paid || false,
            due_date: existing?.due_date || null,
            payment_date: existing?.payment_date || null,
            patient_name: p.name,
          };
        });

      setPayments(records);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [clinicId, patients, refMonth]);

  const handleMarkAsPaid = async (payment: PaymentRecord) => {
    if (!user) return;
    setUpdatingId(payment.id);
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      if (payment.id.startsWith('temp-')) {
        const { data, error } = await supabase
          .from('patient_payment_records')
          .insert({
            user_id: user.id,
            clinic_id: clinicId,
            patient_id: payment.patient_id,
            month: m,
            year: y,
            amount: payment.amount,
            paid: true,
            payment_date: today,
          })
          .select()
          .single();

        if (error) throw error;
        setPayments(prev => prev.map(p => p.id === payment.id ? { ...payment, id: data.id, paid: true, payment_date: today } : p));
      } else {
        const { error } = await supabase
          .from('patient_payment_records')
          .update({ amount: payment.amount, paid: true, payment_date: today })
          .eq('id', payment.id);

        if (error) throw error;
        setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, paid: true, payment_date: today } : p));
      }
      toast.success('Pagamento marcado como concluído');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar pagamento');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendReminder = (payment: PaymentRecord) => {
    const patient = patients.find(p => p.id === payment.patient_id);
    const phone = patient?.phone?.replace(/\D/g, '');
    if (!phone) {
      toast.error('Paciente sem telefone cadastrado');
      return;
    }

    const message = `Olá ${payment.patient_name}, este é um lembrete da sua mensalidade no valor de R$ ${payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Caso já tenha realizado o pagamento, favor desconsiderar.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
  };

  const getStatus = (payment: PaymentRecord) => {
    if (payment.paid) return { label: 'Pago', color: 'success', icon: CheckCircle2 };
    if (payment.due_date && isAfter(new Date(), parseISO(payment.due_date))) {
      return { label: 'Atrasado', color: 'destructive', icon: AlertCircle };
    }
    return { label: 'Pendente', color: 'warning', icon: Clock };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="font-bold text-lg text-foreground">Gestão de Cobranças</h3>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setRefMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-semibold text-foreground capitalize px-2 min-w-[120px] text-center">
            {format(refMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setRefMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum pagamento configurado para este mês.
                  </td>
                </tr>
              ) : (
                payments.map(payment => {
                  const status = getStatus(payment);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{payment.patient_name}</td>
                      <td className="px-4 py-3 text-center text-foreground">
                        R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {payment.due_date ? format(parseISO(payment.due_date), 'dd/MM/yyyy') : 'Não definido'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "gap-1.5 font-semibold",
                              status.color === 'success' && "bg-success/10 text-success border-success/20",
                              status.color === 'warning' && "bg-warning/10 text-warning border-warning/20",
                              status.color === 'destructive' && "bg-destructive/10 text-destructive border-destructive/20"
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0" 
                            title="Enviar Lembrete"
                            onClick={() => handleSendReminder(payment)}
                          >
                            <MessageSquare className="w-4 h-4 text-primary" />
                          </Button>
                          {!payment.paid && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 gap-2 text-xs"
                              disabled={updatingId === payment.id}
                              onClick={() => handleMarkAsPaid(payment)}
                            >
                              {updatingId === payment.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 text-success" />
                              )}
                              Marcar como Pago
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
