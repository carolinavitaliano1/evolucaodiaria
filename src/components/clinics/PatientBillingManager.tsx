import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, MessageSquare, Clock, AlertCircle, Loader2, Send } from 'lucide-react';
import { format, parseISO, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const { patients } = useApp();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPayments = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const now = new Date();
      const m = now.getMonth() + 1;
      const y = now.getFullYear();

      const { data, error } = await supabase
        .from('patient_payment_records')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('month', m)
        .eq('year', y);

      if (error) throw error;

      const clinicPatients = patients.filter(p => p.clinicId === clinicId);
      
      // Map existing records and identify missing ones for patients with paymentValue
      const records: PaymentRecord[] = clinicPatients
        .filter(p => p.paymentValue && p.paymentValue > 0)
        .map(p => {
          const existing = (data || []).find(r => r.patient_id === p.id);
          return {
            id: existing?.id || `temp-${p.id}`,
            patient_id: p.id,
            amount: existing?.amount || p.paymentValue || 0,
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
  }, [clinicId, patients]);

  const handleMarkAsPaid = async (payment: PaymentRecord) => {
    if (!user) return;
    setUpdatingId(payment.id);
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const today = format(now, 'yyyy-MM-dd');

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
          .update({ paid: true, payment_date: today })
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
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg text-foreground">Gestão de Cobranças</h3>
        <Badge variant="outline" className="text-muted-foreground">
          {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </Badge>
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
