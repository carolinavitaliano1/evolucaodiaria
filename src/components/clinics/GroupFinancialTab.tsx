import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight, Plus, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getGroupSessionValue, type GroupBillingMap, type GroupMemberPaymentMap, type GroupPackageConfig } from '@/utils/groupFinancial';
import { EditableReceiptModal } from '@/components/financial/EditableReceiptModal';

interface MemberPatient {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MemberPaymentConfig {
  isPaying: boolean;
  memberPaymentValue: number | null;
}

interface GroupFinancialTabProps {
  groupId: string;
  clinicId: string;
  members: MemberPatient[];
  memberPaymentConfigs: Record<string, MemberPaymentConfig>;
  groupData: {
    default_price: number | null;
    payment_type: string | null;
    package_id: string | null;
    financial_enabled: boolean;
  };
  clinicPackages: any[];
}

interface MemberFinancialRow {
  patientId: string;
  name: string;
  avatarUrl: string | null;
  sessionValue: number;
  billableSessions: number;
  totalDue: number;
  totalPaid: number;
  pending: number;
  status: 'em_dia' | 'parcial' | 'inadimplente' | 'nao_pagante';
}

const BILLABLE_STATUSES = ['presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function GroupFinancialTab({
  groupId, clinicId, members, memberPaymentConfigs, groupData, clinicPackages,
}: GroupFinancialTabProps) {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick payment dialog
  const [payDialog, setPayDialog] = useState<{ patientId: string; name: string; pending: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<{ payerName: string; amount: number; period: string; patientId: string } | null>(null);
  const [therapistInfo, setTherapistInfo] = useState<{ name: string; cpf?: string | null; professionalId?: string | null; cbo?: string | null; address?: string | null } | null>(null);
  const [clinicInfo, setClinicInfo] = useState<{ name?: string | null; address?: string | null; cnpj?: string | null } | null>(null);

  const periodLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  const navigateMonth = (dir: -1 | 1) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  useEffect(() => {
    loadData();
  }, [groupId, selectedMonth, selectedYear, members]);

  const loadData = async () => {
    if (members.length === 0) { setLoading(false); return; }
    setLoading(true);

    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const patientIds = members.map(m => m.id);

    const [evosRes, paysRes] = await Promise.all([
      supabase
        .from('evolutions')
        .select('id, patient_id, date, attendance_status')
        .eq('group_id', groupId)
        .gte('date', startDate)
        .lt('date', endDate),
      supabase
        .from('patient_payment_records')
        .select('*')
        .in('patient_id', patientIds)
        .eq('clinic_id', clinicId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear),
    ]);

    setEvolutions(evosRes.data || []);
    setPayments(paysRes.data || []);
    setLoading(false);
  };

  // Build billing maps for getGroupSessionValue
  const groupBillingMap: GroupBillingMap = useMemo(() => ({
    [groupId]: {
      defaultPrice: groupData.default_price,
      paymentType: groupData.payment_type,
      packageId: groupData.package_id,
      financialEnabled: groupData.financial_enabled,
    },
  }), [groupId, groupData]);

  const memberPaymentMap: GroupMemberPaymentMap = useMemo(() => {
    const map: Record<string, { isPaying: boolean; value: number | null }> = {};
    for (const [pid, cfg] of Object.entries(memberPaymentConfigs)) {
      map[pid] = { isPaying: cfg.isPaying, value: cfg.memberPaymentValue };
    }
    return { [groupId]: map };
  }, [groupId, memberPaymentConfigs]);

  const packages: GroupPackageConfig[] = useMemo(() =>
    clinicPackages.map(p => ({ id: p.id, price: Number(p.price), sessionLimit: p.session_limit })),
  [clinicPackages]);

  // Compute rows
  const rows: MemberFinancialRow[] = useMemo(() => {
    return members.map(m => {
      const config = memberPaymentConfigs[m.id];
      const isPaying = config?.isPaying ?? true;

      const sessionValue = getGroupSessionValue({
        groupId,
        patientId: m.id,
        groupBillingMap,
        memberPaymentMap,
        packages,
      });

      const memberEvos = evolutions.filter(e => e.patient_id === m.id);
      const billable = memberEvos.filter(e => BILLABLE_STATUSES.includes(e.attendance_status));
      const billableSessions = billable.length;

      // For 'mensal' payment type, totalDue is the fixed monthly value (not per-session)
      let totalDue: number;
      if (groupData.payment_type === 'mensal') {
        totalDue = isPaying ? sessionValue : 0; // sessionValue already returns the monthly price for mensal
      } else {
        totalDue = billableSessions * sessionValue;
      }

      const memberPayments = payments.filter(p => p.patient_id === m.id);
      const totalPaid = memberPayments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount), 0);
      const pending = Math.max(0, totalDue - totalPaid);

      let status: MemberFinancialRow['status'];
      if (!isPaying) {
        status = 'nao_pagante';
      } else if (totalDue === 0) {
        status = 'em_dia';
      } else if (totalPaid >= totalDue) {
        status = 'em_dia';
      } else if (totalPaid > 0) {
        status = 'parcial';
      } else {
        status = 'inadimplente';
      }

      return {
        patientId: m.id,
        name: m.name,
        avatarUrl: m.avatar_url,
        sessionValue,
        billableSessions,
        totalDue,
        totalPaid,
        pending,
        status,
      };
    });
  }, [members, evolutions, payments, groupBillingMap, memberPaymentMap, packages, groupData.payment_type, memberPaymentConfigs]);

  // Totals
  const totalDueAll = rows.reduce((s, r) => s + r.totalDue, 0);
  const totalPaidAll = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalPendingAll = rows.reduce((s, r) => s + r.pending, 0);

  const handleQuickPay = async () => {
    if (!user || !payDialog) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Informe um valor válido'); return; }

    setPaying(true);
    try {
      const { error } = await supabase.from('patient_payment_records').upsert({
        user_id: user.id,
        patient_id: payDialog.patientId,
        clinic_id: clinicId,
        month: selectedMonth,
        year: selectedYear,
        amount,
        paid: true,
        payment_date: new Date().toISOString().slice(0, 10),
        notes: `Pagamento grupo — ${periodLabel}`,
      }, { onConflict: 'patient_id,month,year' });
      if (error) throw error;
      toast.success('Pagamento registrado!');

      // Prepare receipt data and load therapist + clinic info
      const payerName = payDialog.name;
      const payerPatientId = payDialog.patientId;
      setPayDialog(null);
      setPayAmount('');
      await loadData();

      // Load therapist profile and clinic info for the receipt
      const [profileRes, clinicRes] = await Promise.all([
        supabase.from('profiles').select('name, cpf, professional_id, cbo').eq('user_id', user.id).maybeSingle(),
        supabase.from('clinics').select('name, address, cnpj').eq('id', clinicId).maybeSingle(),
      ]);

      setTherapistInfo({
        name: profileRes.data?.name || user.email || 'Profissional',
        cpf: profileRes.data?.cpf,
        professionalId: profileRes.data?.professional_id,
        cbo: profileRes.data?.cbo,
      });
      setClinicInfo(clinicRes.data || null);
      setReceiptData({ payerName, amount, period: periodLabel, patientId: payerPatientId });
      setReceiptOpen(true);
    } catch (e: any) {
      toast.error('Erro ao registrar pagamento: ' + (e.message || ''));
    }
    setPaying(false);
  };

  const statusBadge = (status: MemberFinancialRow['status']) => {
    switch (status) {
      case 'em_dia':
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> Em dia</Badge>;
      case 'parcial':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 gap-1 text-xs"><AlertTriangle className="w-3 h-3" /> Parcial</Badge>;
      case 'inadimplente':
        return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0 gap-1 text-xs"><XCircle className="w-3 h-3" /> Inadimplente</Badge>;
      case 'nao_pagante':
        return <Badge variant="secondary" className="text-xs">Não pagante</Badge>;
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between bg-card border rounded-xl p-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-foreground text-sm">{periodLabel}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Devido</p>
          <p className="text-lg font-bold text-foreground">R$ {totalDueAll.toFixed(2)}</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Pago</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {totalPaidAll.toFixed(2)}</p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className={cn("text-lg font-bold", totalPendingAll > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
            R$ {totalPendingAll.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Members table */}
      {members.length === 0 ? (
        <div className="text-center py-8">
          <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nenhum participante</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Paciente</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Sessões</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Total Período</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Pago</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Pendente</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.patientId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <Link to={`/patients/${row.patientId}#financeiro`} className="flex items-center gap-2 hover:underline">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-center text-foreground">{row.billableSessions}</td>
                    <td className="p-3 text-right font-medium text-foreground">R$ {row.totalDue.toFixed(2)}</td>
                    <td className="p-3 text-right font-medium text-green-600 dark:text-green-400">
                      R$ {row.totalPaid.toFixed(2)}
                    </td>
                    <td className={cn("p-3 text-right font-medium", row.pending > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      R$ {row.pending.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">{statusBadge(row.status)}</td>
                    <td className="p-3 text-center">
                      {row.status !== 'nao_pagante' && row.pending > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => { setPayDialog({ patientId: row.patientId, name: row.name, pending: row.pending }); setPayAmount(row.pending.toFixed(2)); }}
                        >
                          <Plus className="w-3 h-3" /> Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-border">
            {rows.map(row => (
              <div key={row.patientId} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Link to={`/patients/${row.patientId}#financeiro`} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground text-sm">{row.name}</span>
                  </Link>
                  {statusBadge(row.status)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Devido</p>
                    <p className="text-sm font-semibold text-foreground">R$ {row.totalDue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Pago</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">R$ {row.totalPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Pendente</p>
                    <p className={cn("text-sm font-semibold", row.pending > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      R$ {row.pending.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{row.billableSessions} sessão(ões) · R$ {row.sessionValue.toFixed(2)}/sessão</span>
                  {row.status !== 'nao_pagante' && row.pending > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setPayDialog({ patientId: row.patientId, name: row.name, pending: row.pending }); setPayAmount(row.pending.toFixed(2)); }}
                    >
                      <Plus className="w-3 h-3" /> Pagar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) setPayDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-medium text-foreground">{payDialog.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="font-medium text-foreground">{periodLabel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Valor pendente: <span className="font-semibold text-red-600 dark:text-red-400">R$ {payDialog.pending.toFixed(2)}</span></p>
              </div>
              <div>
                <Label className="text-sm">Valor do pagamento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={handleQuickPay} disabled={paying} className="gap-2">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt modal — opens after successful payment */}
      {receiptData && therapistInfo && (
        <EditableReceiptModal
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          initial={{
            payerName: receiptData.payerName,
            amount: receiptData.amount,
            serviceName: 'Sessão de Grupo Terapêutico',
            period: receiptData.period,
          }}
          therapist={therapistInfo}
          clinic={clinicInfo}
        />
      )}
    </div>
  );
}
