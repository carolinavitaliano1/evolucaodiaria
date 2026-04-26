import { useState, useMemo, useEffect } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QuickWhatsAppButton } from '@/components/whatsapp/QuickWhatsAppButton';
import { resolveTemplate } from '@/hooks/useMessageTemplates';

interface ClinicAgendaProps {
  clinicId: string;
}

export function ClinicAgenda({ clinicId }: ClinicAgendaProps) {
  const { patients, appointments, evolutions, setCurrentPatient } = useApp();
  const { user } = useAuth();
  const { isOrg, members } = useClinicOrg(clinicId);
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [therapistName, setTherapistName] = useState<string>('');
  const [clinicType, setClinicType] = useState<string | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.name) setTherapistName(data.name); });
  }, [user]);

  useEffect(() => {
    supabase.from('clinics').select('type').eq('id', clinicId).maybeSingle()
      .then(({ data }) => setClinicType((data as any)?.type || null));
  }, [clinicId]);

  useEffect(() => {
    if (clinicType !== 'clinica') { setScheduleSlots([]); return; }
    supabase.from('patient_schedule_slots' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .then(({ data }) => setScheduleSlots((data || []) as any[]));
  }, [clinicId, clinicType]);

  const clinicPatients = patients.filter(p => p.clinicId === clinicId && isPatientActiveOn(p));

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekday = dayNames[viewDate.getDay()];
  const dateStr = format(viewDate, 'yyyy-MM-dd');

  const scheduledPatients = useMemo(() => {
    if (clinicType === 'clinica') {
      // For clinic-type units, derive entries from patient_schedule_slots
      const daySlots = scheduleSlots.filter(s => s.weekday === weekday);
      const filtered = filterUserId === 'all'
        ? daySlots
        : daySlots.filter(s => {
            const m = members.find(mm => mm.id === s.member_id);
            return m?.userId === filterUserId;
          });
      const list = filtered
        .map(s => {
          const patient = clinicPatients.find(p => p.id === s.patient_id);
          if (!patient) return null;
          const time = (s.start_time || '').slice(0, 5);
          const endTime = (s.end_time || '').slice(0, 5);
          return { ...patient, scheduleTime: time, _slotEnd: endTime, _slotMemberId: s.member_id };
        })
        .filter(Boolean) as any[];
      return list.sort((a, b) => (a.scheduleTime || '').localeCompare(b.scheduleTime || ''));
    }
    return clinicPatients
      .filter(p => p.weekdays?.includes(weekday))
      .sort((a, b) => (a.scheduleTime || '').localeCompare(b.scheduleTime || ''));
  }, [clinicPatients, weekday, clinicType, scheduleSlots, filterUserId, members]);

  // Get evolution for a patient on view date, optionally filtering by author
  const getEvolution = (patientId: string) => {
    return evolutions.find(e =>
      e.patientId === patientId &&
      e.clinicId === clinicId &&
      e.date === dateStr &&
      (filterUserId === 'all' || (e as any).userId === filterUserId || (e as any).user_id === filterUserId)
    );
  };

  const handleOpenPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setCurrentPatient(patient);
      navigate(`/patients/${patientId}`);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'presente': return { label: '✅ Presente', cls: 'text-success' };
      case 'reposicao': return { label: '🔄 Reposição', cls: 'text-primary' };
      case 'falta': return { label: '❌ Falta', cls: 'text-destructive' };
      case 'falta_remunerada': return { label: '⚠️ Falta Rem.', cls: 'text-warning' };
      default: return { label: status, cls: 'text-muted-foreground' };
    }
  };

  const memberLabel = (userId: string) => {
    const m = members.find(m => m.userId === userId);
    return m?.name || m?.email || userId;
  };

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl p-4 border border-border">
        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => subDays(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-bold text-foreground">
            {weekday}, {format(viewDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>
          {!isToday(viewDate) && (
            <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setViewDate(new Date())}>
              Ir para hoje
            </Button>
          )}
          {isToday(viewDate) && <p className="text-xs text-primary font-medium">Hoje</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => addDays(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Professional filter (only in org mode) */}
      {isOrg && members.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Profissional:</span>
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="h-8 text-sm w-auto min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {members.map(m => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name || m.email}
                  {m.userId === user?.id ? ' (você)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Schedule */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agenda do Dia ({scheduledPatients.length} pacientes)
        </h3>

        {scheduledPatients.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-muted-foreground">Nenhum paciente agendado para {weekday}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPatients.map(patient => {
              const evo = getEvolution(patient.id);
              const timeRange = patient.scheduleByDay?.[weekday];
              const timeDisplay = timeRange
                ? `${timeRange.start} - ${timeRange.end}`
                : patient.scheduleTime || '--:--';

              // Author of evolution (in org mode)
              const evoAuthorId = (evo as any)?.user_id;
              const showAuthor = isOrg && evoAuthorId && filterUserId === 'all';

              return (
                <div
                  key={patient.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors gap-2",
                    evo
                      ? evo.attendanceStatus === 'presente' || evo.attendanceStatus === 'reposicao'
                        ? "bg-success/10 border-success/30"
                        : evo.attendanceStatus === 'falta_remunerada'
                          ? "bg-warning/10 border-warning/30"
                          : "bg-destructive/10 border-destructive/30"
                      : "bg-secondary/50 border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      <Clock className="w-4 h-4 mr-1" />
                      {patient.scheduleTime || '--'}
                    </div>
                    <div>
                      <p
                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors text-sm"
                        onClick={() => handleOpenPatient(patient.id)}
                      >
                        {patient.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeDisplay}
                        {patient.clinicalArea && ` • ${patient.clinicalArea}`}
                      </p>
                      {clinicType === 'clinica' && (patient as any)._slotMemberId && (() => {
                        const m = members.find(mm => mm.id === (patient as any)._slotMemberId);
                        if (!m) return null;
                        return (
                          <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {m.name || m.email}
                          </p>
                        );
                      })()}
                      {showAuthor && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {memberLabel(evoAuthorId)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {evo ? (
                      <span className={cn("text-xs font-medium", statusLabel(evo.attendanceStatus).cls)}>
                        {statusLabel(evo.attendanceStatus).label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">⏳ Aguardando</span>
                    )}
                    <QuickWhatsAppButton
                      phone={patient.whatsapp || patient.phone || patient.responsibleWhatsapp}
                      tooltip="Confirmar sessão via WhatsApp"
                      message={resolveTemplate(
                        'Olá, {{nome_paciente}}! 😊 Passando para confirmar sua sessão hoje, {{data_consulta}} às {{horario}}. Por favor, confirme sua presença. — {{nome_terapeuta}}',
                        {
                          nome_paciente: patient.name,
                          data_consulta: format(viewDate, "dd/MM", { locale: ptBR }),
                          horario: patient.scheduleTime || timeDisplay,
                          nome_terapeuta: therapistName,
                        }
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
