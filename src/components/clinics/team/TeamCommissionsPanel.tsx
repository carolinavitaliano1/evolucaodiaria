import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ChevronLeft, ChevronRight, Search, DollarSign, CheckCircle2, Circle, ChevronDown, ChevronUp, AlertTriangle, Stamp, Package, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateMemberRemunerationByPlans } from '@/utils/financialHelpers';
import { loadAppointmentValueMap } from '@/utils/appointmentValueMap';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  clinicId: string;
  organizationId: string | null;
}

interface PaymentRecord {
  id?: string;
  member_id: string;
  status: 'open' | 'partial' | 'paid';
  paid_amount: number;
  paid_at: string | null;
  individual_payments: Record<string, { paid: boolean; paid_at?: string }>;
}

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TeamCommissionsPanel({ clinicId, organizationId }: Props) {
  const { user } = useAuth();
  const { clinics, patients, evolutions, clinicPackages } = useApp();
  const { members, loading: orgLoading } = useClinicOrg(clinicId);
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [savingMember, setSavingMember] = useState<string | null>(null);
  const [apptValueMap, setApptValueMap] = useState<Record<string, Record<string, number>>>({});

  const clinic = clinics.find(c => c.id === clinicId);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId),
    [patients, clinicId]
  );

  const monthlyEvolutions = useMemo(
    () => evolutions.filter(e => {
      if (!clinicPatients.some(p => p.id === e.patientId)) return false;
      const d = new Date(e.date + 'T12:00:00');
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    }),
    [evolutions, clinicPatients, month, year]
  );

  useEffect(() => {
    const ids = clinicPatients.map(p => p.id);
    if (!ids.length) { setApptValueMap({}); return; }
    loadAppointmentValueMap({
      patientIds: ids,
      startDate: format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(selectedDate), 'yyyy-MM-dd'),
    }).then(setApptValueMap).catch(() => setApptValueMap({}));
  }, [clinicPatients, selectedDate]);

  // ── Load payment records for the period ──
  useEffect(() => {
    if (!organizationId) return;
    setLoadingPayments(true);
    supabase
      .from('team_commission_payments' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('year', year)
      .eq('month', month)
      .then(({ data, error }) => {
        setLoadingPayments(false);
        if (error) { console.error(error); return; }
        const map: Record<string, PaymentRecord> = {};
        (data || []).forEach((row: any) => {
          map[row.member_id] = {
            id: row.id,
            member_id: row.member_id,
            status: row.status,
            paid_amount: Number(row.paid_amount) || 0,
            paid_at: row.paid_at,
            individual_payments: (row.individual_payments as any) || {},
          };
        });
        setPayments(map);
      });
  }, [clinicId, organizationId, year, month]);

  // ── Compute breakdown per member ──
  const memberRows = useMemo(() => {
    return members.map(member => {
      const memberEvos = monthlyEvolutions
        .filter(e => e.userId === member.userId)
        .map(e => ({
          id: e.id,
          patientId: e.patientId,
          groupId: e.groupId,
          date: e.date,
          attendanceStatus: e.attendanceStatus,
          confirmedAttendance: e.confirmedAttendance,
          userId: e.userId,
        }));

      const breakdown = calculateMemberRemunerationByPlans({
        plans: member.plans || [],
        assignmentPlanMap: member.assignmentPlanMap || {},
        evolutions: memberEvos,
        legacyType: member.remunerationType,
        legacyValue: member.remunerationValue,
        clinic,
        appointmentValueByPatient: apptValueMap,
        packages: clinicPackages.filter(p => p.clinicId === clinicId).map(p => ({
          id: p.id, price: p.price, packageType: p.packageType,
          sessionLimit: p.sessionLimit,
        })),
        month: month - 1,
        year,
      });

      return {
        member,
        total: breakdown.total,
        sessions: memberEvos,
      };
    });
  }, [members, monthlyEvolutions, clinic, clinicPackages, clinicId, clinicPatients, apptValueMap]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return memberRows;
    const q = search.toLowerCase();
    return memberRows.filter(r =>
      (r.member.name || '').toLowerCase().includes(q) ||
      r.member.email.toLowerCase().includes(q)
    );
  }, [memberRows, search]);

  // ── Status helper based on totals + individual marks ──
  const computeStatus = (memberId: string, total: number): 'open' | 'partial' | 'paid' => {
    const rec = payments[memberId];
    if (!rec) return total > 0 ? 'open' : 'paid';
    if (rec.paid_amount >= total && total > 0) return 'paid';
    const indCount = Object.values(rec.individual_payments || {}).filter(p => p.paid).length;
    if (rec.paid_amount > 0 || indCount > 0) return 'partial';
    return 'open';
  };

  const upsertPayment = async (memberId: string, patch: Partial<PaymentRecord>, total: number) => {
    if (!organizationId || !user) return;
    setSavingMember(memberId);
    try {
      const existing = payments[memberId];
      const merged = {
        organization_id: organizationId,
        clinic_id: clinicId,
        member_id: memberId,
        year,
        month,
        total_due: total,
        paid_amount: patch.paid_amount ?? existing?.paid_amount ?? 0,
        paid_at: patch.paid_at ?? existing?.paid_at ?? null,
        paid_by_user_id: user.id,
        individual_payments: patch.individual_payments ?? existing?.individual_payments ?? {},
        status: patch.status ?? existing?.status ?? 'open',
      };
      const { data, error } = await supabase
        .from('team_commission_payments' as any)
        .upsert(merged, { onConflict: 'member_id,clinic_id,year,month' })
        .select()
        .single();
      if (error) throw error;
      setPayments(prev => ({
        ...prev,
        [memberId]: {
          id: (data as any).id,
          member_id: memberId,
          status: (data as any).status,
          paid_amount: Number((data as any).paid_amount) || 0,
          paid_at: (data as any).paid_at,
          individual_payments: ((data as any).individual_payments as any) || {},
        },
      }));
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar status: ' + (e.message || 'desconhecido'));
    } finally {
      setSavingMember(null);
    }
  };

  const handleMarkMonthPaid = (memberId: string, total: number) => {
    upsertPayment(memberId, {
      paid_amount: total,
      paid_at: new Date().toISOString(),
      status: 'paid',
    }, total);
  };

  const handleUnmarkMonth = (memberId: string, total: number) => {
    upsertPayment(memberId, {
      paid_amount: 0,
      paid_at: null,
      status: 'open',
      individual_payments: {},
    }, total);
  };

  const handleToggleSession = (memberId: string, evolutionId: string, total: number, paid: boolean) => {
    const existing = payments[memberId];
    const ind = { ...(existing?.individual_payments || {}) };
    if (paid) ind[evolutionId] = { paid: true, paid_at: new Date().toISOString() };
    else delete ind[evolutionId];
    const indCount = Object.values(ind).filter(p => p.paid).length;
    const sessions = memberRows.find(r => r.member.memberId === memberId)?.sessions || [];
    const allMarked = sessions.length > 0 && indCount >= sessions.length;
    upsertPayment(memberId, {
      individual_payments: ind,
      status: allMarked ? 'paid' : indCount > 0 ? 'partial' : (existing?.paid_amount ? 'partial' : 'open'),
      paid_amount: allMarked ? total : (existing?.paid_amount ?? 0),
      paid_at: allMarked ? new Date().toISOString() : (existing?.paid_at ?? null),
    }, total);
  };

  // ── Footer totals ──
  const totals = useMemo(() => {
    let due = 0, paid = 0;
    filteredRows.forEach(r => {
      due += r.total;
      const rec = payments[r.member.memberId];
      paid += rec?.paid_amount || 0;
    });
    return { due, paid, open: due - paid };
  }, [filteredRows, payments]);

  if (orgLoading || loadingPayments) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header: month selector + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => subMonths(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold capitalize min-w-[160px] text-center">{monthName}</span>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Disclaimer: marcar pago é registro contábil */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-snug text-foreground/80">
        <span className="mt-0.5 shrink-0">ℹ️</span>
        <span>
          <strong>Marcar mês como pago</strong> registra contabilmente o repasse ao profissional — o sistema não realiza
          transferência bancária ou PIX automática. Faça o pagamento pelo seu canal habitual e use este botão apenas para
          atualizar o status que o profissional verá em <em>Minhas Comissões</em>.
        </span>
      </div>

      {/* Member cards */}
      {filteredRows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum colaborador encontrado para este período.
        </div>
      )}

      <div className="space-y-3">
        {filteredRows.map(({ member, total, sessions }) => {
          const rec = payments[member.memberId];
          const status = computeStatus(member.memberId, total);
          const isExpanded = expanded === member.memberId;
          const indPayments = rec?.individual_payments || {};
          const initials = (member.name || member.email).slice(0, 2).toUpperCase();
          const hasPlans = (member.plans || []).length > 0;
          const hasLegacyValue = !!(member.remunerationType && member.remunerationType !== 'definir_depois' && member.remunerationValue);
          const hasClinicModel = !!(clinic?.paymentType && clinic?.paymentAmount);
          const remunerationConfigured = hasPlans || hasLegacyValue || hasClinicModel;
          const needsConfig = sessions.length > 0 && total <= 0 && !remunerationConfigured;
          const statusConfig = {
            open:    { label: 'Em aberto', cls: 'bg-muted text-muted-foreground border-border' },
            partial: { label: 'Parcial',   cls: 'bg-warning/10 text-warning border-warning/30' },
            paid:    { label: 'Pago',      cls: 'bg-success/10 text-success border-success/30' },
          }[status];

          return (
            <div key={member.memberId} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="w-11 h-11">
                  {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-semibold text-foreground">{member.name || member.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Comissão do mês</p>
                  <p className="font-bold text-lg text-foreground">{fmtMoney(total)}</p>
                </div>
                <Badge variant="outline" className={cn('border', statusConfig.cls)}>{statusConfig.label}</Badge>
                {status === 'paid' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingMember === member.memberId}
                    onClick={() => handleUnmarkMonth(member.memberId, total)}
                  >
                    {savingMember === member.memberId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desmarcar'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={total <= 0 || savingMember === member.memberId}
                    onClick={() => handleMarkMonthPaid(member.memberId, total)}
                  >
                    {savingMember === member.memberId
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Marcar mês como pago</>
                    }
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(isExpanded ? null : member.memberId)}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-4 border-t pt-3">
                  {sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem atendimentos no período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-muted-foreground border-b">
                          <tr>
                            <th className="text-left py-2 px-2 w-12">Pago</th>
                            <th className="text-left py-2 px-2">Data</th>
                            <th className="text-left py-2 px-2">Paciente</th>
                            <th className="text-left py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map(s => {
                              const pat = clinicPatients.find(p => p.id === s.patientId);
                              const isPaid = !!indPayments[s.id]?.paid;
                              return (
                                <tr key={s.id} className="border-b last:border-0">
                                  <td className="py-2 px-2">
                                    <Checkbox
                                      checked={isPaid}
                                      onCheckedChange={(v) => handleToggleSession(member.memberId, s.id, total, !!v)}
                                    />
                                  </td>
                                  <td className="py-2 px-2">{format(new Date(s.date + 'T12:00:00'), 'dd/MM')}</td>
                                  <td className="py-2 px-2">{pat?.name || '—'}</td>
                                  <td className="py-2 px-2">
                                    <span className="text-xs text-muted-foreground">{s.attendanceStatus}</span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer totals */}
      {filteredRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border bg-muted/30 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Total devido</p>
            <p className="text-xl font-bold text-foreground">{fmtMoney(totals.due)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total pago</p>
            <p className="text-xl font-bold text-success">{fmtMoney(totals.paid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo em aberto</p>
            <p className="text-xl font-bold text-warning">{fmtMoney(totals.open)}</p>
          </div>
        </div>
      )}
    </div>
  );
}