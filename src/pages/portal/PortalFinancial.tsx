import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import {
  DollarSign, CheckCircle2, Clock, Receipt, Download,
  Copy, AlertCircle, Bell, Send, QrCode, CreditCard, CalendarDays,
  Paperclip, X, FileText, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, differenceInDays, setDate, startOfDay, addMonths, isBefore } from 'date-fns';
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
  due_date: string | null;
}

interface ClinicPaymentData {
  payment_pix_key: string | null;
  payment_pix_name: string | null;
  payment_bank_details: string | null;
  show_payment_in_portal: boolean;
}

interface PackageData {
  name: string;
  package_type: string;
  price: number;
  session_limit: number | null;
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getPaymentDueDate(paymentDueDay: number | null): Date | null {
  if (!paymentDueDay) return null;
  const today = startOfDay(new Date());
  let dueDate = startOfDay(setDate(new Date(), paymentDueDay));
  // If due date already passed this month, next relevant is next month
  if (isBefore(dueDate, today)) {
    dueDate = startOfDay(setDate(addMonths(new Date(), 1), paymentDueDay));
  }
  return dueDate;
}

function getPaymentAlert(paymentDueDay: number | null, currentPaid: boolean) {
  if (currentPaid) return { type: 'paid' as const, daysLeft: 0 };
  if (!paymentDueDay) return null;

  const today = startOfDay(new Date());
  const thisMonthDue = startOfDay(setDate(new Date(), paymentDueDay));
  const diff = differenceInDays(thisMonthDue, today);

  if (diff < 0) return { type: 'overdue' as const, daysLeft: Math.abs(diff) };
  if (diff === 0) return { type: 'today' as const, daysLeft: 0 };
  if (diff <= 5) return { type: 'soon' as const, daysLeft: diff };
  return { type: 'ok' as const, daysLeft: diff };
}

function getRecordStatus(record: PaymentRecord, paymentDueDay: number | null): 'paid' | 'pending' | 'overdue' {
  if (record.paid) return 'paid';
  const today = startOfDay(new Date());
  if (record.due_date) {
    return isBefore(new Date(record.due_date + 'T00:00:00'), today) ? 'overdue' : 'pending';
  }
  if (paymentDueDay) {
    const due = new Date(record.year, record.month - 1, paymentDueDay);
    return isBefore(due, today) ? 'overdue' : 'pending';
  }
  return 'pending';
}

function formatPaymentType(type: string | null): string {
  const map: Record<string, string> = {
    mensal: 'Mensal',
    por_sessao: 'Por Sessão',
    fixo_diaria: 'Fixo Diária',
    personalizado: 'Personalizado',
    variado: 'Variado',
  };
  return type ? (map[type] || type) : 'Não definido';
}

interface ReceiptDoc {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  created_at: string;
}

export default function PortalFinancial() {
  const { portalAccount, patient, sendMessage } = usePortal();
  const { user } = useAuth();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [clinicPayment, setClinicPayment] = useState<ClinicPaymentData | null>(null);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFilePreview, setReceiptFilePreview] = useState<string | null>(null);
  const [receiptDocs, setReceiptDocs] = useState<ReceiptDoc[]>([]);
  const [calculatedRevenue, setCalculatedRevenue] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!portalAccount || !patient) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: recs }, { data: pat }, { data: pkg }] = await Promise.all([
          supabase
            .from('patient_payment_records')
            .select('id, month, year, amount, paid, payment_date, notes, due_date')
            .eq('patient_id', portalAccount.patient_id)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(24),
          supabase
            .from('patients')
            .select('payment_info, clinic_id, show_payment_in_portal, package_id')
            .eq('id', portalAccount.patient_id)
            .single(),
          patient.clinic_id
            ? supabase
                .from('clinic_packages')
                .select('name, package_type, price, session_limit')
                .eq('clinic_id', patient.clinic_id)
                .limit(1)
            : Promise.resolve({ data: null }),
        ]);

        setRecords((recs || []) as PaymentRecord[]);

        // Load package if patient has one
        if ((pat as any)?.package_id) {
          const { data: pkgData } = await supabase
            .from('clinic_packages')
            .select('name, package_type, price, session_limit')
            .eq('id', (pat as any).package_id)
            .single();
          if (pkgData) setPackageData(pkgData as PackageData);
        }

        // Load clinic payment info — show if clinic OR patient toggle is on
        const patientShowPayment = (pat as any)?.show_payment_in_portal ?? false;
        if ((pat as any)?.clinic_id) {
          const { data: clinicData } = await supabase
            .from('clinics')
            .select('payment_pix_key, payment_pix_name, payment_bank_details, show_payment_in_portal')
            .eq('id', (pat as any).clinic_id)
            .single();
          if (clinicData) {
            // If patient-level toggle is on, force show_payment_in_portal to true
            const merged = {
              ...clinicData,
              show_payment_in_portal: clinicData.show_payment_in_portal || patientShowPayment,
            };
            setClinicPayment(merged as ClinicPaymentData);
          }
        }

        // Load receipt documents uploaded by portal user
        const { data: docs } = await supabase
          .from('portal_documents')
          .select('id, name, file_path, file_type, file_size, description, created_at')
          .eq('portal_account_id', portalAccount.id)
          .ilike('name', 'Comprovante%')
          .order('created_at', { ascending: false });
        setReceiptDocs((docs || []) as ReceiptDoc[]);

        // Calculate actual monthly revenue via DB function
        const cm = new Date().getMonth() + 1;
        const cy = new Date().getFullYear();
        const { data: revenueData } = await supabase.rpc('get_patient_monthly_revenue', {
          _patient_id: portalAccount.patient_id,
          _month: cm,
          _year: cy,
        });
        setCalculatedRevenue(typeof revenueData === 'number' ? revenueData : null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [portalAccount, patient]);

  const handleRequestReceipt = async (record: PaymentRecord) => {
    if (!portalAccount) return;
    setRequesting(record.id);
    try {
      const { error } = await supabase.from('portal_messages').insert({
        patient_id: portalAccount.patient_id,
        therapist_user_id: portalAccount.therapist_user_id,
        portal_account_id: portalAccount.id,
        sender_type: 'patient',
        content: `Olá! Gostaria de solicitar o recibo de pagamento referente a ${MONTH_NAMES[record.month]}/${record.year} (R$ ${Number(record.amount).toFixed(2).replace('.', ',')}).`,
        message_type: 'message',
        read_by_patient: true,
        read_by_therapist: false,
      });
      if (error) throw error;
      toast.success('Solicitação de recibo enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar recibo');
    } finally {
      setRequesting(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato não suportado. Use JPG, PNG, WebP ou PDF.');
      return;
    }
    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      setReceiptFilePreview(URL.createObjectURL(file));
    } else {
      setReceiptFilePreview(null);
    }
  };

  const clearFile = () => {
    setReceiptFile(null);
    if (receiptFilePreview) URL.revokeObjectURL(receiptFilePreview);
    setReceiptFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendReceipt = async () => {
    if (!portalAccount || !user || (!receiptText.trim() && !receiptFile)) return;
    setSendingReceipt(true);
    try {
      let filePath = '';
      let fileName = '';
      let fileType = '';
      let fileSize: number | null = null;

      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop() || 'bin';
        filePath = `${portalAccount.therapist_user_id}/${portalAccount.id}/receipts/${Date.now()}.${ext}`;
        fileName = receiptFile.name;
        fileType = receiptFile.type;
        fileSize = receiptFile.size;

        const { error: uploadError } = await supabase.storage
          .from('portal-documents')
          .upload(filePath, receiptFile, { contentType: receiptFile.type });
        if (uploadError) throw uploadError;

        // Save to portal_documents so it appears in the Documents tab
        const { error: docError } = await supabase.from('portal_documents').insert({
          name: `Comprovante - ${fileName}`,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          description: receiptText.trim() || 'Comprovante de pagamento',
          patient_id: portalAccount.patient_id,
          portal_account_id: portalAccount.id,
          therapist_user_id: portalAccount.therapist_user_id,
          uploaded_by_type: 'portal',
          uploaded_by_user_id: user.id,
        });
        if (docError) throw docError;
      }

      // Send notification message to therapist
      const label = portalAccount.access_label || 'Paciente';
      const msgContent = receiptFile
        ? `🧾 ${label} enviou um comprovante de pagamento${receiptText.trim() ? `: ${receiptText.trim()}` : ''}. O documento está disponível na aba Documentos.`
        : `🧾 ${label} enviou informações de pagamento:\n\n${receiptText.trim()}`;

      await sendMessage(msgContent, 'message');
      toast.success('Comprovante enviado com sucesso!');
      setReceiptText('');
      clearFile();
      setShowReceipt(false);

      // Reload receipt docs list
      const { data: docs } = await supabase
        .from('portal_documents')
        .select('id, name, file_path, file_type, file_size, description, created_at')
        .eq('portal_account_id', portalAccount.id)
        .ilike('name', 'Comprovante%')
        .order('created_at', { ascending: false });
      setReceiptDocs((docs || []) as ReceiptDoc[]);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar comprovante');
    } finally {
      setSendingReceipt(false);
    }
  };

  const handleDownloadReceipt = async (doc: ReceiptDoc) => {
    const { data } = await supabase.storage
      .from('portal-documents')
      .createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Erro ao abrir documento');
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Build display records: include a virtual pending record for current month if none exists
  const displayRecords = (() => {
    const all = [...records];
    const hasCurrentMonth = all.some(r => r.month === currentMonth && r.year === currentYear);
    // Use calculated revenue (includes group sessions) or fallback to payment_value
    const virtualAmount = calculatedRevenue != null && calculatedRevenue > 0
      ? calculatedRevenue
      : Number(patient?.payment_value || 0);
    if (!hasCurrentMonth && virtualAmount > 0) {
      all.unshift({
        id: 'virtual-current',
        month: currentMonth,
        year: currentYear,
        amount: virtualAmount,
        paid: false,
        payment_date: null,
        notes: null,
        due_date: patient?.payment_due_day
          ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(patient.payment_due_day).padStart(2, '0')}`
          : null,
      });
    }
    return all;
  })();

  const currentRecord = displayRecords.find(r => r.month === currentMonth && r.year === currentYear);
  const alert = getPaymentAlert(patient?.payment_due_day || null, !!currentRecord?.paid);
  const totalPaid = displayRecords.filter(r => r.paid).reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = displayRecords.filter(r => !r.paid).reduce((s, r) => s + Number(r.amount), 0);

  if (loading) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Acompanhe seus pagamentos e situação financeira</p>
        </div>

        {/* 1. Plan/Contract Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Resumo do Plano</CardTitle>
                <CardDescription className="text-xs">Detalhes do seu contrato</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tipo</p>
                <p className="font-semibold text-foreground">
                  {formatPaymentType(patient?.payment_type || null)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Valor</p>
                <p className="font-semibold text-foreground">
                  {patient?.payment_value
                    ? `R$ ${Number(patient.payment_value).toFixed(2).replace('.', ',')}`
                    : 'Não definido'}
                </p>
              </div>
              {packageData?.name && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Pacote</p>
                  <p className="font-semibold text-foreground">{packageData.name}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Vencimento</p>
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {patient?.payment_due_day ? `Dia ${patient.payment_due_day}` : 'Não definido'}
                </p>
              </div>
              {packageData?.session_limit && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Sessões/mês</p>
                  <p className="font-semibold text-foreground">{packageData.session_limit}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Payment Status Alert */}
        {alert && (
          <>
            {alert.type === 'paid' && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">Pagamento em dia ✅</AlertTitle>
                <AlertDescription className="text-emerald-600/80 dark:text-emerald-400/70 text-xs">
                  O pagamento de {MONTH_NAMES[currentMonth]} está quitado. Obrigado!
                </AlertDescription>
              </Alert>
            )}
            {alert.type === 'ok' && (
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">Situação regular</AlertTitle>
                <AlertDescription className="text-emerald-600/80 dark:text-emerald-400/70 text-xs">
                  Próximo vencimento em {alert.daysLeft} dias (dia {patient?.payment_due_day}).
                </AlertDescription>
              </Alert>
            )}
            {alert.type === 'soon' && (
              <Alert className="border-amber-500/40 bg-amber-500/5">
                <Bell className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">
                  Atenção: Falt{alert.daysLeft === 1 ? 'a 1 dia' : `am ${alert.daysLeft} dias`} para o vencimento
                </AlertTitle>
                <AlertDescription className="text-amber-600/80 dark:text-amber-400/70 text-xs">
                  Vencimento dia {patient?.payment_due_day}
                  {patient?.payment_value ? ` — R$ ${Number(patient.payment_value).toFixed(2).replace('.', ',')}` : ''}
                </AlertDescription>
              </Alert>
            )}
            {alert.type === 'today' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Vencimento hoje!</AlertTitle>
                <AlertDescription className="text-xs">
                  O pagamento de {MONTH_NAMES[currentMonth]} vence hoje.
                  {patient?.payment_value ? ` Valor: R$ ${Number(patient.payment_value).toFixed(2).replace('.', ',')}` : ''}
                </AlertDescription>
              </Alert>
            )}
            {alert.type === 'overdue' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Pagamento atrasado</AlertTitle>
                <AlertDescription className="text-xs">
                  Em atraso há {alert.daysLeft} dia{alert.daysLeft > 1 ? 's' : ''}. Por favor, regularize sua situação.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* PIX / Payment Info */}
        {clinicPayment?.show_payment_in_portal && (clinicPayment.payment_pix_key || clinicPayment.payment_bank_details) && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <QrCode className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">Como Pagar</CardTitle>
                  <CardDescription className="text-xs">Dados de pagamento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {clinicPayment.payment_pix_name && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Titular</p>
                  <p className="text-sm font-semibold text-foreground">{clinicPayment.payment_pix_name}</p>
                </div>
              )}
              {clinicPayment.payment_pix_key && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Chave PIX</p>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 bg-card rounded-lg px-3 py-2.5 border font-mono text-sm break-all min-h-[40px] flex items-center">
                      {clinicPayment.payment_pix_key}
                    </div>
                    <Button
                      size="icon"
                      className="h-10 w-10 shrink-0 self-center"
                      onClick={() => {
                        navigator.clipboard.writeText(clinicPayment.payment_pix_key!);
                        toast.success('Chave PIX copiada!');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {clinicPayment.payment_bank_details && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Dados bancários</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{clinicPayment.payment_bank_details}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Send receipt */}
        <Card>
          <CardContent className="p-4">
            {!showReceipt ? (
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => setShowReceipt(true)}>
                <Send className="w-3.5 h-3.5" />
                Enviar comprovante ao terapeuta
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-foreground">Anexe uma imagem/PDF do comprovante ou descreva:</p>

                {/* File upload area */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {!receiptFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 flex flex-col items-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Paperclip className="w-5 h-5" />
                    <span className="text-xs font-medium">Clique para anexar comprovante</span>
                    <span className="text-[10px]">JPG, PNG, WebP ou PDF (máx. 10MB)</span>
                  </button>
                ) : (
                  <div className="relative border rounded-lg p-3 bg-muted/30">
                    <button
                      type="button"
                      onClick={clearFile}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {receiptFilePreview ? (
                      <img src={receiptFilePreview} alt="Comprovante" className="max-h-40 rounded-md mx-auto object-contain" />
                    ) : (
                      <div className="flex items-center gap-2 pr-6">
                        <FileText className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{receiptFile.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">PDF</Badge>
                      </div>
                    )}
                  </div>
                )}

                <Textarea
                  value={receiptText}
                  onChange={e => setReceiptText(e.target.value)}
                  placeholder="Observação opcional: Ex: Pix enviado às 14:32..."
                  className="resize-none text-sm min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setShowReceipt(false); setReceiptText(''); clearFile(); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5 text-xs" disabled={(!receiptText.trim() && !receiptFile) || sendingReceipt} onClick={handleSendReceipt}>
                    <Send className="w-3 h-3" />
                    {sendingReceipt ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Uploaded receipts list */}
        {receiptDocs.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                Comprovantes Enviados
              </CardTitle>
              <CardDescription className="text-xs">Seus comprovantes de pagamento anexados</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {receiptDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {doc.file_type?.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-primary" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(doc.created_at), "d/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => handleDownloadReceipt(doc)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs text-emerald-600 font-medium">Total Pago</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                R$ {totalPaid.toFixed(2).replace('.', ',')}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(
            totalPending > 0
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-border'
          )}>
            <CardContent className="p-4">
              <Clock className={cn('w-5 h-5 mb-2', totalPending > 0 ? 'text-amber-600' : 'text-muted-foreground')} />
              <p className={cn('text-xs font-medium', totalPending > 0 ? 'text-amber-600' : 'text-muted-foreground')}>Pendente</p>
              <p className={cn('text-lg font-bold', totalPending > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                R$ {totalPending.toFixed(2).replace('.', ',')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3. Payment History Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Histórico de Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-0 md:px-6">
            {displayRecords.length === 0 ? (
              <div className="text-center py-8 px-4">
                <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-sm text-foreground">Sem registros financeiros</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhum lançamento disponível ainda.</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referência</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRecords.map(record => {
                        const status = getRecordStatus(record, patient?.payment_due_day || null);
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {MONTH_NAMES[record.month]} {record.year}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.paid && record.payment_date
                                ? format(new Date(record.payment_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              R$ {Number(record.amount).toFixed(2).replace('.', ',')}
                            </TableCell>
                            <TableCell>
                              {status === 'paid' && (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                  Pago
                                </Badge>
                              )}
                              {status === 'pending' && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  Pendente
                                </Badge>
                              )}
                              {status === 'overdue' && (
                                <Badge variant="destructive">Atrasado</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {record.paid && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs h-8"
                                  onClick={() => handleRequestReceipt(record)}
                                  disabled={requesting === record.id}
                                >
                                  <Receipt className="w-3 h-3" />
                                  Recibo
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden space-y-2 px-4">
                  {displayRecords.map(record => {
                    const status = getRecordStatus(record, patient?.payment_due_day || null);
                    return (
                      <div key={record.id} className="bg-card rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {MONTH_NAMES[record.month]} {record.year}
                              </p>
                              {status === 'paid' && (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] px-1.5 py-0">
                                  Pago
                                </Badge>
                              )}
                              {status === 'pending' && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                                  Pendente
                                </Badge>
                              )}
                              {status === 'overdue' && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>
                              )}
                            </div>
                            <p className="text-base font-bold text-foreground mt-0.5">
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
                              <Receipt className="w-3 h-3" />
                              Recibo
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
