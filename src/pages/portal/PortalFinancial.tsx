import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import {
  Loader2, DollarSign, CheckCircle2, Clock, Receipt,
  Copy, AlertCircle, Bell, Paperclip, Send, X, ChevronDown, ChevronUp, QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInDays, setDate, startOfDay } from 'date-fns';
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

function getDueDateAlert(paymentDueDay: number | null): { type: 'today' | 'soon' | 'overdue' | null; daysLeft: number } {
  if (!paymentDueDay) return { type: null, daysLeft: 0 };
  const today = startOfDay(new Date());
  const dueDate = startOfDay(setDate(new Date(), paymentDueDay));
  const diff = differenceInDays(dueDate, today);

  if (diff === 0) return { type: 'today', daysLeft: 0 };
  if (diff > 0 && diff <= 3) return { type: 'soon', daysLeft: diff };
  if (diff < 0) return { type: 'overdue', daysLeft: Math.abs(diff) };
  return { type: null, daysLeft: diff };
}

interface ClinicPaymentData {
  payment_pix_key: string | null;
  payment_pix_name: string | null;
  payment_bank_details: string | null;
  show_payment_in_portal: boolean;
}

export default function PortalFinancial() {
  const { portalAccount, patient, sendMessage } = usePortal();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);
  const [clinicPayment, setClinicPayment] = useState<ClinicPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!portalAccount) return;
    Promise.all([
      supabase
        .from('patient_payment_records')
        .select('*')
        .eq('patient_id', portalAccount.patient_id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12),
      supabase
        .from('patients')
        .select('payment_info, clinic_id')
        .eq('id', portalAccount.patient_id)
        .single(),
    ]).then(async ([{ data: recs }, { data: pat }]) => {
      setRecords((recs || []) as PaymentRecord[]);
      setPaymentInfo((pat as any)?.payment_info || null);
      // Load clinic payment data if clinic_id exists
      if ((pat as any)?.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('payment_pix_key, payment_pix_name, payment_bank_details, show_payment_in_portal')
          .eq('id', (pat as any).clinic_id)
          .single();
        if (clinicData) setClinicPayment(clinicData as ClinicPaymentData);
      }
      setLoading(false);
    });
  }, [portalAccount]);

  const handleCopyPaymentInfo = () => {
    if (!paymentInfo) return;
    navigator.clipboard.writeText(paymentInfo);
    toast.success('Copiado! 📋');
  };

  const handleRequestReceipt = async (record: PaymentRecord) => {
    if (!portalAccount) return;
    setRequesting(record.id);
    try {
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
      toast.success('Solicitação de recibo enviada! ✉️');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar recibo');
    } finally {
      setRequesting(null);
    }
  };

  const handleSendReceipt = async () => {
    if (!portalAccount || !receiptText.trim()) return;
    setSendingReceipt(true);
    try {
      await sendMessage(`🧾 Comprovante de pagamento enviado:\n\n${receiptText.trim()}`, 'message');
      toast.success('Comprovante enviado ao terapeuta! ✅');
      setReceiptText('');
      setShowReceiptUpload(false);
    } catch (err: any) {
      toast.error('Erro ao enviar comprovante');
    } finally {
      setSendingReceipt(false);
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentRecord = records.find(r => r.month === currentMonth && r.year === currentYear);
  const totalPaid = records.filter(r => r.paid).reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = records.filter(r => !r.paid).reduce((s, r) => s + Number(r.amount), 0);
  const dueDateAlert = getDueDateAlert(patient?.payment_due_day || null);

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Acompanhe seus pagamentos</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Due date alert */}
            {dueDateAlert.type && !currentRecord?.paid && (
              <div className={cn(
                'rounded-2xl border px-4 py-3 flex items-start gap-3',
                dueDateAlert.type === 'today' && 'bg-destructive/10 border-destructive/20 text-destructive',
                dueDateAlert.type === 'soon' && 'bg-warning/10 border-warning/20 text-warning',
                dueDateAlert.type === 'overdue' && 'bg-destructive/10 border-destructive/20 text-destructive',
              )}>
                <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {dueDateAlert.type === 'today' && '⚠️ Vencimento hoje!'}
                    {dueDateAlert.type === 'soon' && `⏰ Vence em ${dueDateAlert.daysLeft} dia${dueDateAlert.daysLeft > 1 ? 's' : ''}!`}
                    {dueDateAlert.type === 'overdue' && `❗ Pagamento em atraso há ${dueDateAlert.daysLeft} dia${dueDateAlert.daysLeft > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Dia {patient?.payment_due_day} de cada mês
                    {patient?.payment_value ? ` — R$ ${Number(patient.payment_value).toFixed(2).replace('.', ',')}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* PIX / Payment data card — from clinic settings */}
            {clinicPayment?.show_payment_in_portal && (clinicPayment.payment_pix_key || clinicPayment.payment_bank_details) && (
              <div className="rounded-2xl border-2 border-success/30 bg-success/5 overflow-hidden shadow-sm">
                <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Como Pagar</p>
                    <p className="text-[10px] text-muted-foreground">Dados de pagamento do seu terapeuta</p>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {clinicPayment.payment_pix_name && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Titular</p>
                      <p className="text-sm font-semibold text-foreground">{clinicPayment.payment_pix_name}</p>
                    </div>
                  )}
                  {clinicPayment.payment_pix_key && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Chave PIX</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-card rounded-xl px-3 py-2 border border-success/20">
                          <p className="text-sm font-mono font-semibold text-foreground break-all">{clinicPayment.payment_pix_key}</p>
                        </div>
                        <Button
                          size="icon"
                          className="h-9 w-9 shrink-0 bg-success hover:bg-success/90 text-success-foreground border-0"
                          onClick={() => {
                            navigator.clipboard.writeText(clinicPayment.payment_pix_key!);
                            toast.success('Chave PIX copiada! ✅');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {clinicPayment.payment_bank_details && (
                    <div className="pt-1 border-t border-success/20">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Outros dados bancários</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{clinicPayment.payment_bank_details}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment method card (legacy - from patient payment_info) */}
            {paymentInfo && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setShowPaymentInfo(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Dados para pagamento</span>
                  </div>
                  {showPaymentInfo ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showPaymentInfo && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="bg-muted rounded-xl p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{paymentInfo}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={handleCopyPaymentInfo}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar dados de pagamento
                    </Button>
                    {/* Send receipt */}
                    {!showReceiptUpload ? (
                      <Button
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={() => setShowReceiptUpload(true)}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Enviar comprovante ao terapeuta
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground">Cole o número do comprovante ou descreva:</p>
                          <button onClick={() => setShowReceiptUpload(false)}>
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <Textarea
                          value={receiptText}
                          onChange={e => setReceiptText(e.target.value)}
                          placeholder="Ex: Pix enviado às 14:32 — Cód. E00000000..."
                          className="resize-none text-sm min-h-[70px]"
                        />
                        <Button
                          size="sm"
                          className="w-full gap-2 text-xs"
                          disabled={!receiptText.trim() || sendingReceipt}
                          onClick={handleSendReceipt}
                        >
                          {sendingReceipt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Enviar comprovante
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* No payment info but has due date — show reminder to send receipt */}
            {!paymentInfo && patient?.payment_due_day && (
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Enviar comprovante</p>
                </div>
                {!showReceiptUpload ? (
                  <Button size="sm" className="w-full gap-2 text-xs" onClick={() => setShowReceiptUpload(true)}>
                    <Paperclip className="w-3.5 h-3.5" />
                    Enviar comprovante ao terapeuta
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={receiptText}
                      onChange={e => setReceiptText(e.target.value)}
                      placeholder="Descreva ou cole o código do comprovante..."
                      className="resize-none text-sm min-h-[70px]"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowReceiptUpload(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="flex-1 gap-1.5 text-xs" disabled={!receiptText.trim() || sendingReceipt} onClick={handleSendReceipt}>
                        {sendingReceipt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
