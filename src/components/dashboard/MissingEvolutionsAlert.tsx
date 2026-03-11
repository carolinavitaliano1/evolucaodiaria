import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toLocalDateString } from '@/lib/utils';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function MissingEvolutionsAlert() {
  const { patients, appointments, evolutions } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  // Refresh every minute to re-check elapsed sessions
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayStr = toLocalDateString(now);
  const todayWeekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper: convert "HH:MM" → minutes
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  // Default session duration in minutes (used when no end time is defined)
  const DEFAULT_SESSION_DURATION = 50;

  // Build list of today's scheduled patients with their session time
  const scheduledToday: { patientId: string; name: string; startTime: string; endMin: number; avatarUrl?: string | null }[] = [];

  // 1. Recurring weekly patients
  patients.forEach(p => {
    if (p.isArchived) return;
    const schedByDay = p.scheduleByDay as Record<string, { start?: string; end?: string }> | null;
    const scheduledDays = schedByDay ? Object.keys(schedByDay) : (p.weekdays || []);
    if (!scheduledDays.includes(todayWeekday)) return;
    const startTime = schedByDay?.[todayWeekday]?.start || p.scheduleTime || '';
    if (!startTime || startTime === '00:00') return;
    const endStr = schedByDay?.[todayWeekday]?.end;
    const endMin = endStr ? toMin(endStr) : toMin(startTime) + DEFAULT_SESSION_DURATION;
    scheduledToday.push({ patientId: p.id, name: p.name, startTime, endMin, avatarUrl: p.avatarUrl });
  });

  // 2. One-off appointments (avoid duplicates)
  const existingIds = new Set(scheduledToday.map(s => s.patientId));
  appointments
    .filter(a => a.date === todayStr && !existingIds.has(a.patientId))
    .forEach(a => {
      const patient = patients.find(p => p.id === a.patientId);
      if (!patient || patient.isArchived) return;
      const startTime = a.time || '';
      if (!startTime || startTime === '00:00') return;
      const endMin = toMin(startTime) + DEFAULT_SESSION_DURATION;
      scheduledToday.push({ patientId: patient.id, name: patient.name, startTime, endMin, avatarUrl: patient.avatarUrl });
    });

  // Filter: session has ENDED (nowMinutes > endMin) AND no evolution recorded today
  const missing = scheduledToday.filter(s => {
    if (nowMinutes <= s.endMin) return false; // session hasn't ended yet
    const hasEvo = evolutions.some(e => e.patientId === s.patientId && e.date === todayStr);
    return !hasEvo;
  });

  if (missing.length === 0) return null;

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
            Sessão(ões) já encerrada(s) sem registro de evolução
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {missing.map(s => (
          <button
            key={s.patientId}
            onClick={() => navigate(`/patients/${s.patientId}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors text-left group"
          >
            <div className="w-7 h-7 rounded-full bg-warning/20 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-warning">
              {s.avatarUrl
                ? <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover rounded-full" />
                : s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">Sessão às {s.startTime.slice(0, 5)} · sem evolução</p>
            </div>
            <ArrowRight className="w-4 h-4 text-warning opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
