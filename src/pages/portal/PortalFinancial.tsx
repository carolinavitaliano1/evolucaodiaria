import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2, DollarSign, CheckCircle2, Clock, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PaymentRecord {
  id: string;
  month: number;
  year: number;
  amount: number;
  paid: boolean;
  payment_date: string | null;
  notes: string | null;
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function PortalFinancial() {
  const { portalAccount } = usePortal();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!portalAccount) return;
    supabase
      .from('patient_payment_records')
      .select('*')
      .eq('patient_id', portalAccount.patient_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        setRecords((data || []) as PaymentRecord[]);
        setLoading(false);
      });
  }, [portalAccount]);

  const handleRequestReceipt = async (record: PaymentRecord) => {
    if (!portalAccount) return;
    setRequesting(record.id);
    try {
      // Send a message to the therapist requesting receipt
      const { error } = await supabase.from('portal_messages').insert({
        patient_id: portalAccount.patient_id,
        therapist_user_id: portalAccount.therapist_user_id,
        sender_type: 'patient',
        content: `Olá! Gostaria de solicitar o recibo de pagamento referente a ${MONTH_NAMES[record.month]}/${record.year} (R$ ${record.amount.toFixed(2).replace('.', ',')}).`,
        message_type: 'message',
        read_by_patient: true,
        read_by_therapist: false,
      });
      if (error) throw error;
      toast.success('Solicitação de recibo enviada! Seu terapeuta receberá a notificação.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar recibo');
    } finally {
      setRequesting(null);
    }
  };

  const totalPaid = records.filter(r => r.paid).reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = records.filter(r => !r.paid).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Resumo dos seus pagamentos</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-success/10 rounded-2xl border border-success/20 p-4">
                <CheckCircle2 className="w-5 h-5 text-success mb-2" />
                <p className="text-xs text-success font-medium">Pagos</p>
                <p className="text-lg font-bold text-success">
                  R$ {totalPaid.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className={cn('rounded-2xl border p-4', totalPending > 0 ? 'bg-warning/10 border-warning/20' : 'bg-muted border-border')}>
                <Clock className={cn('w-5 h-5 mb-2', totalPending > 0 ? 'text-warning' : 'text-muted-foreground')} />
                <p className={cn('text-xs font-medium', totalPending > 0 ? 'text-warning' : 'text-muted-foreground')}>Pendente</p>
                <p className={cn('text-lg font-bold', totalPending > 0 ? 'text-warning' : 'text-muted-foreground')}>
                  R$ {totalPending.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>

            {/* Records */}
            {records.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-sm text-foreground">Sem registros financeiros</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhum lançamento disponível ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {records.map(record => (
                  <div key={record.id} className="bg-card rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {MONTH_NAMES[record.month]} {record.year}
                          </p>
                          {record.paid ? (
                            <span className="text-[10px] font-medium text-success flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Pago
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-warning flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> Pendente
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-foreground">
                          R$ {Number(record.amount).toFixed(2).replace('.', ',')}
                        </p>
                        {record.paid && record.payment_date && (
                          <p className="text-[10px] text-muted-foreground">
                            Pago em {format(new Date(record.payment_date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      {record.paid && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-8 flex-shrink-0"
                          onClick={() => handleRequestReceipt(record)}
                          disabled={requesting === record.id}
                        >
                          {requesting === record.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Receipt className="w-3 h-3" />
                          }
                          Recibo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}
