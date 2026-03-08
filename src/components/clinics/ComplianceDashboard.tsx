import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertTriangle, CalendarIcon, Search, RefreshCw, MessageCircle,
  User, ClipboardCheck, CheckCircle2, Clock, BellRing, FileDown, Bell,
} from 'lucide-react';
import { format, subDays, parseISO, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { openWhatsApp } from '@/hooks/useMessageTemplates';
import jsPDF from 'jspdf';

interface PendingEvolution {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  date: string;          // yyyy-MM-dd
  therapistUserId: string;
  therapistName: string;
  therapistPhone: string | null;
  memberId: string;
}

interface MemberProfile {
  userId: string;
  memberId: string;
  name: string;
  phone: string | null;
  email: string;
}

interface ComplianceDashboardProps {
  clinicId: string;
  organizationId: string;
}

const PERIOD_OPTIONS = [
  { value: '1', label: 'Hoje' },
  { value: '3', label: 'Últimos 3 dias' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimas 2 semanas' },
  { value: '30', label: 'Último mês' },
  { value: 'custom', label: 'Personalizado' },
];

export function ComplianceDashboard({ clinicId, organizationId }: ComplianceDashboardProps) {
  const { patients } = useApp();
  const [pending, setPending] = useState<PendingEvolution[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyingAll, setNotifyingAll] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTherapist, setFilterTherapist] = useState('all');
  const [periodDays, setPeriodDays] = useState('7');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);

  const dateRange = useMemo(() => {
    if (periodDays === 'custom') {
      return {
        start: customStart ? format(customStart, 'yyyy-MM-dd') : format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        end: customEnd ? format(customEnd, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      };
    }
    const days = parseInt(periodDays, 10);
    return {
      start: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    };
  }, [periodDays, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load all active members of the org with their profiles
      const { data: membersData } = await supabase
        .from('organization_members')
        .select('id, user_id, email')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      if (!membersData?.length) { setPending([]); setLoading(false); return; }

      const userIds = membersData.filter(m => m.user_id).map(m => m.user_id!);
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, name, phone').in('user_id', userIds)
        : { data: [] as any[] };

      const profileMap: Record<string, { name: string | null; phone: string | null }> = {};
      (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = { name: p.name, phone: p.phone }; });

      const memberProfiles: MemberProfile[] = membersData
        .filter(m => m.user_id)
        .map(m => ({
          userId: m.user_id!,
          memberId: m.id,
          name: profileMap[m.user_id!]?.name || m.email,
          phone: profileMap[m.user_id!]?.phone || null,
          email: m.email,
        }));
      setMembers(memberProfiles);

      // 2. Load therapist_patient_assignments for this org
      const memberIds = membersData.map(m => m.id);
      const { data: assignmentsData } = await supabase
        .from('therapist_patient_assignments')
        .select('member_id, patient_id')
        .eq('organization_id', organizationId)
        .in('member_id', memberIds);

      if (!assignmentsData?.length) { setPending([]); setLoading(false); return; }

      // 3. Get patient phones
      const assignedPatientIds = [...new Set(assignmentsData.map(a => a.patient_id))];
      const { data: patientPhones } = await supabase
        .from('patients')
        .select('id, phone')
        .in('id', assignedPatientIds);
      const patientPhoneMap: Record<string, string | null> = {};
      (patientPhones || []).forEach((p: any) => { patientPhoneMap[p.id] = p.phone; });

      // 4. Load appointments for this clinic in date range
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('id, patient_id, user_id, date, time')
        .eq('clinic_id', clinicId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (!appointmentsData?.length) { setPending([]); setLoading(false); return; }

      // 5. Load evolutions in same range for this clinic
      const { data: evolutionsData } = await supabase
        .from('evolutions')
        .select('id, patient_id, user_id, date')
        .eq('clinic_id', clinicId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      const evolutionSet = new Set(
        (evolutionsData || []).map(e => `${e.patient_id}::${e.user_id}::${e.date}`)
      );

      // 6. Cross-reference: appointments from assigned therapists without evolutions
      const pendingList: PendingEvolution[] = [];
      for (const apt of appointmentsData) {
        const assignment = assignmentsData.find(
          a => a.patient_id === apt.patient_id &&
               membersData.find(m => m.id === a.member_id)?.user_id === apt.user_id
        );
        if (!assignment) continue; // not an org assignment

        const key = `${apt.patient_id}::${apt.user_id}::${apt.date}`;
        if (evolutionSet.has(key)) continue; // evolution exists

        const memberProfile = memberProfiles.find(m => m.userId === apt.user_id);
        if (!memberProfile) continue;

        const patient = patients.find(p => p.id === apt.patient_id);
        if (!patient) continue;

        // Avoid duplicates per patient+therapist+date
        const dupKey = `${apt.patient_id}::${apt.user_id}::${apt.date}`;
        if (pendingList.some(p => `${p.patientId}::${p.therapistUserId}::${p.date}` === dupKey)) continue;

        pendingList.push({
          appointmentId: apt.id,
          patientId: apt.patient_id,
          patientName: patient.name,
          patientPhone: patientPhoneMap[apt.patient_id] || null,
          date: apt.date,
          therapistUserId: apt.user_id,
          therapistName: memberProfile.name,
          therapistPhone: memberProfile.phone,
          memberId: assignment.member_id,
        });
      }

      setPending(pendingList);
    } catch (err) {
      console.error('ComplianceDashboard error:', err);
      toast.error('Erro ao carregar pendências');
    } finally {
      setLoading(false);
    }
  }, [clinicId, organizationId, dateRange, patients]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    return pending.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || p.patientName.toLowerCase().includes(q)
        || p.therapistName.toLowerCase().includes(q);
      const matchTherapist = filterTherapist === 'all' || p.therapistUserId === filterTherapist;
      return matchSearch && matchTherapist;
    });
  }, [pending, search, filterTherapist]);

  function buildMessage(item: PendingEvolution) {
    const formattedDate = format(parseISO(item.date), "dd 'de' MMMM", { locale: ptBR });
    return `Olá ${item.therapistName}, notamos que a evolução do paciente *${item.patientName}* do dia *${formattedDate}* ainda não foi finalizada. Por favor, regularize assim que possível. 🙏`;
  }

  function sendWhatsAppNotification(item: PendingEvolution) {
    if (!item.therapistPhone) {
      toast.error('Terapeuta não possui telefone cadastrado');
      return;
    }
    openWhatsApp(item.therapistPhone, buildMessage(item));
    toast.success('WhatsApp aberto!');
  }

  async function notifyAll() {
    const withPhone = filtered.filter(i => i.therapistPhone);
    if (!withPhone.length) {
      toast.error('Nenhum terapeuta com telefone cadastrado nos pendentes filtrados');
      return;
    }
    setNotifyingAll(true);
    // Group by therapist to avoid duplicate tabs — send one message per therapist
    // listing all their pending patients in one go
    const byTherapist: Record<string, PendingEvolution[]> = {};
    withPhone.forEach(i => {
      if (!byTherapist[i.therapistUserId]) byTherapist[i.therapistUserId] = [];
      byTherapist[i.therapistUserId].push(i);
    });
    let opened = 0;
    for (const [, items] of Object.entries(byTherapist)) {
      const phone = items[0].therapistPhone!;
      const name = items[0].therapistName;
      if (items.length === 1) {
        openWhatsApp(phone, buildMessage(items[0]));
      } else {
        const list = items
          .map(i => `• *${i.patientName}* (${format(parseISO(i.date), "dd/MM", { locale: ptBR })})`)
          .join('\n');
        const msg = `Olá ${name}, identificamos evoluções pendentes para os seguintes pacientes:\n\n${list}\n\nPor favor, regularize assim que possível. 🙏`;
        openWhatsApp(phone, msg);
      }
      opened++;
      // Small delay so browsers don't block multiple tabs
      await new Promise(r => setTimeout(r, 600));
    }
    toast.success(`${opened} terapeuta(s) notificado(s)!`);
    setNotifyingAll(false);
  }

  const therapistOptions = useMemo(() => {
    const seen = new Set<string>();
    return members.filter(m => {
      if (seen.has(m.userId)) return false;
      seen.add(m.userId);
      return true;
    });
  }, [members]);

  const stats = useMemo(() => {
    const byTherapist: Record<string, number> = {};
    pending.forEach(p => {
      byTherapist[p.therapistName] = (byTherapist[p.therapistName] || 0) + 1;
    });
    const mostBehind = Object.entries(byTherapist).sort((a, b) => b[1] - a[1])[0];
    return { total: pending.length, byTherapist, mostBehind };
  }, [pending]);

  // Urgency helper reused in render
  function getUrgency(dateStr: string): 'high' | 'medium' | 'low' {
    const hoursAgo = differenceInHours(new Date(), parseISO(dateStr));
    if (hoursAgo >= 72) return 'high';
    if (hoursAgo >= 24) return 'medium';
    return 'low';
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Painel de Conformidade
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atendimentos realizados sem evolução vinculada
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className={cn(
            'rounded-xl border p-3 flex flex-col gap-0.5',
            stats.total > 0
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-success/5 border-success/20'
          )}>
            <span className="text-2xl font-bold text-foreground">{stats.total}</span>
            <span className="text-xs text-muted-foreground">Evoluções pendentes</span>
            {stats.total === 0 && (
              <span className="text-xs text-success font-medium flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Tudo em dia!
              </span>
            )}
          </div>
          <div className="rounded-xl border bg-card p-3 flex flex-col gap-0.5">
            <span className="text-2xl font-bold text-foreground">{Object.keys(stats.byTherapist).length}</span>
            <span className="text-xs text-muted-foreground">Terapeutas com pendência</span>
          </div>
          {stats.mostBehind && (
            <div className="rounded-xl border bg-warning/5 border-warning/20 p-3 flex flex-col gap-0.5 col-span-2 sm:col-span-1">
              <span className="text-xs text-muted-foreground">Mais pendências</span>
              <span className="text-sm font-semibold text-foreground truncate">{stats.mostBehind[0]}</span>
              <span className="text-xs text-warning font-medium">{stats.mostBehind[1]} pendente(s)</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente ou terapeuta..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterTherapist} onValueChange={setFilterTherapist}>
          <SelectTrigger className="h-8 text-sm w-auto min-w-[140px]">
            <User className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Terapeuta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os terapeutas</SelectItem>
            {therapistOptions.map(m => (
              <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodDays} onValueChange={v => { setPeriodDays(v); }}>
          <SelectTrigger className="h-8 text-sm w-auto min-w-[130px]">
            <CalendarIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {periodDays === 'custom' && (
          <div className="flex items-center gap-1.5">
            <Popover open={calendarTarget === 'start'} onOpenChange={o => setCalendarTarget(o ? 'start' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {customStart ? format(customStart, 'dd/MM/yy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customStart}
                  onSelect={d => { setCustomStart(d); setCalendarTarget(null); }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">até</span>
            <Popover open={calendarTarget === 'end'} onOpenChange={o => setCalendarTarget(o ? 'end' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {customEnd ? format(customEnd, 'dd/MM/yy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customEnd}
                  onSelect={d => { setCustomEnd(d); setCalendarTarget(null); }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Notificar Todos */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellRing className="w-4 h-4 shrink-0" />
            <span>
              <span className="font-semibold text-foreground">{filtered.length}</span> pendência(s) —{' '}
              {filtered.filter(i => i.therapistPhone).length} com telefone cadastrado
            </span>
          </div>
          <Button
            size="sm"
            onClick={notifyAll}
            disabled={notifyingAll || filtered.every(i => !i.therapistPhone)}
            className="gap-2 bg-[#25D366] hover:bg-[#1ebc58] text-white border-[#25D366] shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {notifyingAll ? 'Notificando...' : 'Notificar Todos os Pendentes'}
          </Button>
        </div>
      )}

      {/* Table / List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-2">
          <div className="text-4xl">✅</div>
          <p className="font-semibold text-foreground">
            {pending.length === 0 ? 'Nenhuma evolução pendente!' : 'Nenhum resultado para os filtros aplicados'}
          </p>
          <p className="text-sm text-muted-foreground">
            {pending.length === 0
              ? `Todos os atendimentos dos últimos ${periodDays === '1' ? 'dia' : periodDays + ' dias'} estão com evolução registrada.`
              : 'Tente ajustar os filtros de busca.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 border-b border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" /> &gt;24h</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" /> &gt;72h (crítico)</span>
          </div>

          {/* Desktop table header */}
          <div className="hidden sm:grid grid-cols-[24px_1fr_1fr_120px_140px] gap-4 px-4 py-2 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span />
            <span>Paciente</span>
            <span>Terapeuta</span>
            <span>Data</span>
            <span>Ação</span>
          </div>

          <div className="divide-y divide-border">
            {filtered.map(item => {
              const urgency = getUrgency(item.date);
              const hoursAgo = differenceInHours(new Date(), parseISO(item.date));
              const daysAgo = Math.floor(hoursAgo / 24);

              const dotColor =
                urgency === 'high' ? 'bg-destructive' :
                urgency === 'medium' ? 'bg-warning' :
                'bg-success';

              const rowBg =
                urgency === 'high' ? 'bg-destructive/5 hover:bg-destructive/10' :
                urgency === 'medium' ? 'bg-warning/5 hover:bg-warning/10' :
                'hover:bg-muted/20';

              const borderLeft =
                urgency === 'high' ? 'border-l-2 border-l-destructive' :
                urgency === 'medium' ? 'border-l-2 border-l-warning' :
                'border-l-2 border-l-success';

              return (
                <div
                  key={item.appointmentId}
                  className={cn(
                    'flex flex-col sm:grid sm:grid-cols-[24px_1fr_1fr_120px_140px] gap-2 sm:gap-4 px-4 py-3.5 items-start sm:items-center transition-colors',
                    rowBg, borderLeft
                  )}
                >
                  {/* Color dot */}
                  <div className="hidden sm:flex items-center justify-center">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotColor)} />
                  </div>

                  {/* Patient */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('sm:hidden w-2 h-2 rounded-full shrink-0 mt-1', dotColor)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.patientName}</p>
                      {urgency === 'high' && (
                        <span className="text-[10px] text-destructive font-semibold flex items-center gap-0.5 mt-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> {daysAgo}d de atraso — crítico
                        </span>
                      )}
                      {urgency === 'medium' && (
                        <span className="text-[10px] text-warning font-semibold flex items-center gap-0.5 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> {hoursAgo}h pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Therapist */}
                  <div className="flex items-center gap-1.5 min-w-0 sm:block pl-4 sm:pl-0">
                    <span className="sm:hidden text-xs text-muted-foreground">Terapeuta:</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs py-0 gap-1">
                        <User className="w-2.5 h-2.5" />
                        {item.therapistName}
                      </Badge>
                      {!item.therapistPhone && (
                        <span className="text-[10px] text-muted-foreground italic">sem tel.</span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5 sm:block pl-4 sm:pl-0">
                    <span className="sm:hidden text-xs text-muted-foreground">Data:</span>
                    <span className="text-sm text-foreground">
                      {format(parseISO(item.date), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 pl-4 sm:pl-0">
                    <Button
                      size="sm"
                      variant={item.therapistPhone ? 'default' : 'outline'}
                      disabled={!item.therapistPhone}
                      onClick={() => sendWhatsAppNotification(item)}
                      className={cn(
                        'gap-1.5 text-xs h-7 px-2.5',
                        item.therapistPhone && 'bg-[#25D366] hover:bg-[#1ebc58] text-white border-[#25D366]'
                      )}
                      title={!item.therapistPhone ? 'Terapeuta sem telefone cadastrado' : 'Notificar via WhatsApp'}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Notificar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} pendência(s) encontrada(s) • {dateRange.start === dateRange.end
            ? format(parseISO(dateRange.start), "dd/MM/yyyy")
            : `${format(parseISO(dateRange.start), "dd/MM")} – ${format(parseISO(dateRange.end), "dd/MM/yyyy")}`
          }
        </p>
      )}
    </div>
  );
}
