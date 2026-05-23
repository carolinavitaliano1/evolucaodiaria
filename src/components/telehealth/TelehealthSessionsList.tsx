import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Trash2, Video, Loader2, RefreshCcw, FileText, PhoneOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TranscriptionDialog } from './TranscriptionDialog';
import { useTelehealthCall } from '@/contexts/TelehealthCallContext';

interface VideoSession {
  id: string;
  status: string;
  recording_enabled: boolean;
  patient_consented_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  recordings?: Recording[];
}
interface Recording {
  id: string;
  status: string;
  daily_recording_id: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface Props { patientId: string; patientName?: string; clinicId?: string; therapySessionId?: string; }

function fmtSize(b?: number | null) {
  if (!b) return '';
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
}
function fmtDur(s?: number | null) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function TelehealthSessionsList({ patientId, patientName, clinicId, therapySessionId }: Props) {
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transcribeRec, setTranscribeRec] = useState<{ id: string; label: string } | null>(null);
  const { call, endCall } = useTelehealthCall();

  async function load() {
    setLoading(true);
    try {
      let query = supabase
        .from('video_sessions')
        .select('id, status, recording_enabled, patient_consented_at, started_at, ended_at, duration_seconds, created_at, video_recordings(id, status, daily_recording_id, duration_seconds, file_size_bytes, created_at)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (therapySessionId) {
        query = query.eq('therapy_session_id', therapySessionId);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      setSessions(
        (data || []).map((s: any) => ({
          ...s,
          recordings: (s.video_recordings || []) as Recording[],
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`telehealth-recordings-${patientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_recordings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function handleDownload(rec: Recording) {
    setBusyId(rec.id);
    try {
      const { data, error } = await supabase.functions.invoke('get-recording-url', {
        body: { recording_id: rec.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any).download_url;
      if (!url) throw new Error('Sem link disponível');
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar link');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(rec: Recording) {
    if (!confirm('Excluir esta gravação? Esta ação não pode ser desfeita.')) return;
    setBusyId(rec.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-recording', {
        body: { recording_id: rec.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Gravação excluída');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEndSession(s: VideoSession) {
    if (!confirm('Encerrar esta sessão de teleatendimento?')) return;
    setBusyId(s.id);
    try {
      const started = s.started_at ? new Date(s.started_at).getTime() : null;
      const duration = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : s.duration_seconds;
      const { error } = await supabase
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', s.id);
      if (error) throw error;
      if (call?.sessionId === s.id) endCall();
      toast.success('Sessão encerrada e salva no histórico');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao encerrar sessão');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (sessions.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">Nenhuma sessão anterior.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Histórico</p>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={load}>
          <RefreshCcw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {format(new Date(s.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status !== 'ended' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1.5 text-xs"
                    disabled={busyId === s.id}
                    onClick={() => handleEndSession(s)}
                  >
                    {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneOff className="w-3 h-3" />}
                    Encerrar sessão
                  </Button>
                )}
                <Badge variant={s.status === 'ended' ? 'secondary' : 'default'} className="text-[10px]">
                  {s.status === 'ended' ? 'Encerrada' : s.status === 'active' ? 'Em andamento' : 'Agendada'}
                </Badge>
              </div>
            </div>
            {s.recording_enabled && (
              <p className="text-[11px] text-muted-foreground">
                {s.patient_consented_at ? '✓ Consentimento registrado' : '⚠ Sem consentimento do paciente'}
              </p>
            )}
            {(s.recordings || []).length > 0 ? (
              <div className="space-y-1.5 pt-1 border-t">
                {(s.recordings || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={r.status === 'ready' ? 'default' : r.status === 'error' ? 'destructive' : 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {r.status === 'ready' ? 'Pronta' : r.status === 'recording' ? 'Gravando' : r.status === 'error' ? 'Erro' : 'Processando'}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {fmtDur(r.duration_seconds)} {fmtSize(r.file_size_bytes) && `• ${fmtSize(r.file_size_bytes)}`}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={r.status !== 'ready' || busyId === r.id}
                        onClick={() => handleDownload(r)}
                        title="Baixar gravação"
                      >
                        {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-primary hover:text-primary"
                        disabled={r.status !== 'ready'}
                        onClick={() =>
                          setTranscribeRec({
                            id: r.id,
                            label: format(new Date(s.created_at), "d MMM yyyy, HH:mm", { locale: ptBR }),
                          })
                        }
                        title="Transcrever áudio"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        disabled={busyId === r.id}
                        onClick={() => handleDelete(r)}
                        title="Excluir gravação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : s.recording_enabled ? (
              <p className="text-[11px] text-muted-foreground italic">
                Gravação aparece aqui ~2 min após encerrar.
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <TranscriptionDialog
        open={!!transcribeRec}
        onOpenChange={(v) => { if (!v) setTranscribeRec(null); }}
        recordingId={transcribeRec?.id ?? null}
        recordingLabel={transcribeRec?.label}
        patientName={patientName}
        patientId={patientId}
        clinicId={clinicId}
      />
    </div>
  );
}