import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTelehealthAccess } from '@/hooks/useTelehealthAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mic, Square, Upload, Loader2, Wand2, Trash2, Sparkles, FileAudio, Copy } from 'lucide-react';

interface Recording {
  id: string;
  title: string | null;
  storage_path: string;
  duration_seconds: number | null;
  source: string;
  transcription_status: string;
  transcription_text: string | null;
  transcription_error: string | null;
  created_at: string;
}

interface Props {
  patientId: string;
  patientName: string;
  clinicId: string;
  clinicType?: string | null;
}

function fmtDuration(s: number | null): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function InPersonTranscriptionTab({ patientId, patientName, clinicId, clinicType }: Props) {
  const { user } = useAuth();
  const access = useTelehealthAccess(clinicType);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<Record<string, string>>({});
  const [generatingEvolutionId, setGeneratingEvolutionId] = useState<string | null>(null);
  const [evolutions, setEvolutions] = useState<Record<string, string>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('in_person_recordings')
      .select('id,title,storage_path,duration_seconds,source,transcription_status,transcription_text,transcription_error,created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar gravações');
    setRecordings((data || []) as Recording[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    if (!access.enabled) {
      toast.error(access.reason || 'Recurso indisponível');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        await uploadBlob(blob, 'browser', mime);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const uploadBlob = async (blob: Blob, source: 'browser' | 'upload', mime: string) => {
    if (!user) return;
    setUploading(true);
    try {
      // Estimate duration via audio element
      const duration = await estimateDuration(blob).catch(() => null);

      const ext = mime.includes('webm')
        ? 'webm'
        : mime.includes('mpeg') || mime.includes('mp3')
          ? 'mp3'
          : mime.includes('wav')
            ? 'wav'
            : mime.includes('mp4') || mime.includes('m4a')
              ? 'm4a'
              : 'audio';
      const recId = crypto.randomUUID();
      const path = `${user.id}/${recId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('session-recordings')
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('in_person_recordings').insert({
        id: recId,
        patient_id: patientId,
        therapist_user_id: user.id,
        clinic_id: clinicId,
        storage_path: path,
        mime_type: mime,
        file_size_bytes: blob.size,
        duration_seconds: duration,
        source,
        title: `Sessão ${new Date().toLocaleString('pt-BR')}`,
      });
      if (insErr) throw insErr;
      toast.success('Gravação salva');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao salvar gravação');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      toast.error('Arquivo maior que 200MB');
      return;
    }
    uploadBlob(file, 'upload', file.type || 'audio/mpeg');
  };

  const transcribe = async (rec: Recording) => {
    setTranscribingId(rec.id);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-in-person', {
        body: { recording_id: rec.id, language: 'pt' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Transcrição concluída');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao transcrever');
      await load();
    } finally {
      setTranscribingId(null);
    }
  };

  const remove = async (rec: Recording) => {
    if (!confirm('Excluir esta gravação? Esta ação não pode ser desfeita.')) return;
    try {
      await supabase.storage.from('session-recordings').remove([rec.storage_path]);
      await supabase.from('in_person_recordings').delete().eq('id', rec.id);
      toast.success('Gravação excluída');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    }
  };

  const saveText = async (rec: Recording) => {
    const text = editingText[rec.id];
    if (text === undefined) return;
    const { error } = await supabase
      .from('in_person_recordings')
      .update({ transcription_text: text })
      .eq('id', rec.id);
    if (error) toast.error('Erro ao salvar');
    else {
      toast.success('Texto salvo');
      setEditingText((s) => {
        const next = { ...s };
        delete next[rec.id];
        return next;
      });
      await load();
    }
  };

  const generateEvolution = async (rec: Recording) => {
    const text = editingText[rec.id] ?? rec.transcription_text;
    if (!text || text.trim().length < 20) {
      toast.error('Transcrição muito curta');
      return;
    }
    setGeneratingEvolutionId(rec.id);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-from-transcript', {
        body: { transcript: text, patientName },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEvolutions((s) => ({ ...s, [rec.id]: (data as any).evolution || '' }));
      toast.success('Evolução gerada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar evolução');
    } finally {
      setGeneratingEvolutionId(null);
    }
  };

  if (access.loading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!access.enabled) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {access.reason || 'Recurso indisponível no seu plano.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Capture controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-primary" />
            Transcrição de sessão presencial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Grave o áudio da sessão no navegador ou envie um arquivo. A transcrição é processada por IA
            (PT-BR, com separação de falantes) e pode virar evolução clínica com um clique.
            <strong className="block mt-1">Importante:</strong> obtenha consentimento explícito do paciente antes de gravar.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <Button onClick={startRecording} disabled={uploading} className="gap-2">
                <Mic className="w-4 h-4" /> Iniciar gravação
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" /> Parar ({fmtDuration(elapsed)})
              </Button>
            )}

            <label>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading || recording}
              />
              <Button asChild variant="outline" disabled={uploading || recording} className="gap-2">
                <span><Upload className="w-4 h-4" /> Enviar arquivo de áudio</span>
              </Button>
            </label>

            {uploading && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Enviando…
              </span>
            )}
            {recording && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /> Gravando
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recordings list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando gravações…</div>
      ) : recordings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma gravação ainda.
          </CardContent>
        </Card>
      ) : (
        recordings.map((rec) => {
          const text = editingText[rec.id] ?? rec.transcription_text ?? '';
          const isEditing = editingText[rec.id] !== undefined;
          const isTranscribing = transcribingId === rec.id || rec.transcription_status === 'processing';
          const ev = evolutions[rec.id];
          return (
            <Card key={rec.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-sm">{rec.title || 'Sessão'}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(rec.created_at).toLocaleString('pt-BR')} · {fmtDuration(rec.duration_seconds)} ·{' '}
                      {rec.source === 'browser' ? 'Gravado no app' : 'Upload'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.transcription_status === 'ready' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        Transcrito
                      </Badge>
                    )}
                    {rec.transcription_status === 'error' && (
                      <Badge variant="destructive">Erro</Badge>
                    )}
                    {rec.transcription_status === 'processing' && (
                      <Badge variant="secondary">Processando…</Badge>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(rec)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {rec.transcription_status !== 'ready' && (
                  <Button
                    onClick={() => transcribe(rec)}
                    disabled={isTranscribing}
                    size="sm"
                    className="gap-2"
                  >
                    {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {isTranscribing ? 'Transcrevendo…' : 'Transcrever com IA'}
                  </Button>
                )}
                {rec.transcription_error && (
                  <p className="text-xs text-destructive">{rec.transcription_error}</p>
                )}

                {rec.transcription_status === 'ready' && (
                  <>
                    <Textarea
                      value={text}
                      onChange={(e) => setEditingText((s) => ({ ...s, [rec.id]: e.target.value }))}
                      rows={8}
                      className="text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      {isEditing && (
                        <Button size="sm" variant="outline" onClick={() => saveText(rec)}>
                          Salvar edição
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => generateEvolution(rec)}
                        disabled={generatingEvolutionId === rec.id}
                        className="gap-2"
                      >
                        {generatingEvolutionId === rec.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Gerar evolução com IA
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(text);
                          toast.success('Transcrição copiada');
                        }}
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" /> Copiar
                      </Button>
                    </div>

                    {ev && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-semibold text-primary">Evolução gerada (edite e cole na aba Evoluções)</p>
                        <Textarea
                          value={ev}
                          onChange={(e) => setEvolutions((s) => ({ ...s, [rec.id]: e.target.value }))}
                          rows={8}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(ev);
                            toast.success('Evolução copiada');
                          }}
                          className="gap-2"
                        >
                          <Copy className="w-4 h-4" /> Copiar evolução
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

async function estimateDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(d) ? Math.round(d) : null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}