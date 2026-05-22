import { useEffect, useState } from 'react';
import { Video, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UpcomingSession {
  id: string;
  patient_access_token: string;
  scheduled_for: string | null;
  status: string;
}

/**
 * Shows the patient's upcoming online (telehealth) sessions with a one-tap
 * link to enter the room. Hidden when there are none.
 */
export function PortalUpcomingTelehealth() {
  const { patient } = usePortal();
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);

  useEffect(() => {
    if (!patient?.id) return;
    let cancelled = false;
    const nowIso = new Date().toISOString();
    const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      const { data } = await supabase
        .from('video_sessions')
        .select('id, patient_access_token, scheduled_for, status')
        .eq('patient_id', patient.id)
        .in('status', ['scheduled', 'active'])
        .or(`scheduled_for.gte.${nowIso},scheduled_for.is.null`)
        .lte('scheduled_for', horizon)
        .order('scheduled_for', { ascending: true, nullsFirst: false })
        .limit(5);
      if (!cancelled) setSessions((data ?? []) as UpcomingSession[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [patient?.id]);

  if (sessions.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Video className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Próximas sessões online</p>
      </div>
      <div className="divide-y divide-border">
        {sessions.map((s) => {
          const when = s.scheduled_for
            ? format(new Date(s.scheduled_for), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })
            : 'Pronta para entrar';
          const href = `/teleatendimento/${s.patient_access_token}`;
          return (
            <a
              key={s.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 active:bg-accent/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate capitalize">{when}</p>
                <p className="text-xs text-muted-foreground">
                  {s.status === 'active' ? 'Sala aberta — entre agora' : 'Toque para entrar na sala'}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}