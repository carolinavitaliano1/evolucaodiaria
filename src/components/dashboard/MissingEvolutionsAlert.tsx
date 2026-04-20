import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toLocalDateString } from '@/lib/utils';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useCalendarBlocks } from '@/hooks/useCalendarBlocks';

const DEFAULT_SESSION_DURATION = 50;
const DAYS_BACK = 7; // look back up to 7 days

interface PendingEntry {
  patientId: string;
  name: string;
  startTime: string;
  date: string; // yyyy-MM-dd
  avatarUrl?: string | null;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "EEE d/MM", { locale: ptBR });
}

export function MissingEvolutionsAlert() {
  const { patients, appointments } = useApp();
  const { user } = useAuth();
  const { isDateBlocked } = useCalendarBlocks();
  const navigate = useNavigate();
  const [missing, setMissing] = useState<PendingEntry[]>([]);

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  useEffect(() => {
    if (!user || patients.length === 0) return;
    computeMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, patients, appointments, isDateBlocked]);

  async function computeMissing() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    // Build candidate list across last DAYS_BACK days
    const candidates: PendingEntry[] = [];

    for (let daysAgo = 0; daysAgo <= DAYS_BACK; daysAgo++) {
      const d = subDays(now, daysAgo);
      const dateStr = toLocalDateString(d);
      const weekday = WEEKDAY_NAMES[d.getDay()];
      const isPast = daysAgo > 0;

      // 1. Recurring patients
      patients.forEach(p => {
        if (p.isArchived) return;
        // Don't check days before the patient was registered
        if (p.createdAt) {
          const patientCreatedDate = toLocalDateString(new Date(p.createdAt));
          if (dateStr < patientCreatedDate) return;
        }
        // Skip if this date is blocked (holiday/vacation) for the patient's clinic
        if (isDateBlocked(dateStr, p.clinicId)) return;
        const schedByDay = p.scheduleByDay as Record<string, { start?: string; end?: string }> | null;
        const scheduledDays = schedByDay ? Object.keys(schedByDay) : (p.weekdays || []);
        if (!scheduledDays.includes(weekday)) return;
        const startTime = schedByDay?.[weekday]?.start || p.scheduleTime || '';
        if (!startTime || startTime === '00:00') return;
        const endStr = schedByDay?.[weekday]?.end;
        const endMin = endStr ? toMin(endStr) : toMin(startTime) + DEFAULT_SESSION_DURATION;
        // For today, only include if session has ended
        if (!isPast && nowMinutes <= endMin) return;
        candidates.push({ patientId: p.id, name: p.name, startTime, date: dateStr, avatarUrl: p.avatarUrl });
      });

      // 2. One-off appointments (avoid duplicates per day)
      const recurringIds = new Set(candidates.filter(c => c.date === dateStr).map(c => c.patientId));
      appointments
        .filter(a => a.date === dateStr && !recurringIds.has(a.patientId))
        .forEach(a => {
          const patient = patients.find(p => p.id === a.patientId);
          if (!patient || patient.isArchived) return;
          // Skip if this date is blocked for the patient's clinic
          if (isDateBlocked(dateStr, patient.clinicId)) return;
          const startTime = a.time || '';
          if (!startTime || startTime === '00:00') return;
          const endMin = toMin(startTime) + DEFAULT_SESSION_DURATION;
          if (!isPast && nowMinutes <= endMin) return;
          candidates.push({ patientId: patient.id, name: patient.name, startTime, date: dateStr, avatarUrl: patient.avatarUrl });
        });
    }

    if (candidates.length === 0) { setMissing([]); return; }

    // Fetch evolutions for all candidate (patient, date) pairs in one query
    const startDate = toLocalDateString(subDays(now, DAYS_BACK));
    const endDate = toLocalDateString(now);
    const patientIds = [...new Set(candidates.map(c => c.patientId))];

    const { data: evols } = await supabase
      .from('evolutions')
      .select('patient_id, date')
      .eq('user_id', user!.id)
      .in('patient_id', patientIds)
      .gte('date', startDate)
      .lte('date', endDate);

    const evolSet = new Set((evols || []).map(e => `${e.patient_id}::${e.date}`));

    // Deduplicate: one entry per (patientId, date)
    const seen = new Set<string>();
    const result: PendingEntry[] = [];
    for (const c of candidates) {
      const key = `${c.patientId}::${c.date}`;
      if (!evolSet.has(key) && !seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }

    // Sort: today first, then by date desc
    result.sort((a, b) => b.date.localeCompare(a.date));
    setMissing(result);
  }

  if (missing.length === 0) return null;

  const todayMissing = missing.filter(s => s.date === toLocalDateString(new Date()));
  const pastMissing = missing.filter(s => s.date !== toLocalDateString(new Date()));

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-semibold text-warning">
            {missing.length === 1
              ? '1 evolução pendente'
              : `${missing.length} evoluções pendentes`}
          </p>
          <p className="text-xs text-muted-foreground">
            Sessões encerradas sem registro de evolução
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {missing.map(s => (
          <button
            key={`${s.patientId}::${s.date}`}
            onClick={() => navigate(`/patients/${s.patientId}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors text-left group"
          >
            <div className="w-7 h-7 rounded-full bg-warning/20 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-warning">
              {s.avatarUrl
                ? <img loading="lazy" decoding="async" src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover rounded-full" />
                : s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dayLabel(s.date)} às {s.startTime.slice(0, 5)} · sem evolução
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-warning opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        ))}
      </div>

      {pastMissing.length > 0 && (
        <p className="text-[10px] text-warning/70 text-center">
          ⚠️ {pastMissing.length} pendência{pastMissing.length > 1 ? 's' : ''} de dias anteriores
        </p>
      )}
    </div>
  );
}
