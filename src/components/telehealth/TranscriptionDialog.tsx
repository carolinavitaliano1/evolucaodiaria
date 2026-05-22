import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, Sparkles, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recordingId: string | null;
  recordingLabel?: string;
  patientName?: string;
  patientId?: string;
  clinicId?: string;
}

export function TranscriptionDialog({ open, onOpenChange, recordingId, recordingLabel, patientName, patientId, clinicId }: Props) {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [cached, setCached] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [evolution, setEvolution] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function runTranscription(force = false) {
    if (!recordingId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-recording', {
        body: { recording_id: recordingId, language: 'pt' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTranscript((data as any).text || '');
      setCached(!!(data as any).cached);
      if (!(data as any).cached) toast.success('Transcrição concluída');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao transcrever');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && recordingId) {
      setTranscript('');
      setCached(false);
      setEvolution('');
      setSavedId(null);
      runTranscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordingId]);

  function copyAll() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    toast.success('Texto copiado');
  }

  async function generateEvolution() {
    if (!transcript || transcript.trim().length < 20) {
      toast.error('Transcrição muito curta');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-from-transcript', {
        body: { transcript, patientName },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEvolution((data as any).evolution || '');
      toast.success('Evolução clínica gerada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar evolução');
    } finally {
      setGenerating(false);
    }
  }

  function copyEvolution() {
    if (!evolution) return;
    navigator.clipboard.writeText(evolution);
    toast.success('Evolução copiada');
  }

  async function saveAsEvolution() {
    if (!evolution.trim()) { toast.error('Sem texto de evolução'); return; }
    if (!patientId || !clinicId) { toast.error('Paciente/clínica não identificados'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Sessão expirada');
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('evolutions')
        .insert({
          user_id: uid,
          patient_id: patientId,
          clinic_id: clinicId,
          date: today,
          text: evolution.trim(),
          attendance_status: 'presente',
        })
        .select('id')
        .single();
      if (error) throw error;
      setSavedId(data.id);
      toast.success('Evolução salva no histórico do paciente');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar evolução');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Transcrição da gravação
          </DialogTitle>
          <DialogDescription>
            {recordingLabel ? `Sessão de ${recordingLabel}.` : ''}{' '}
            Gerada com ElevenLabs Scribe (português, com identificação de falantes).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              Transcrevendo áudio... pode levar alguns minutos.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Transcrição</p>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Sem texto."
                  className="min-h-[200px] max-h-[35dvh] resize-none font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Evolução clínica (IA)
                  </p>
                  {evolution && (
                    <Button variant="ghost" size="sm" onClick={copyEvolution} className="h-7 gap-1 text-xs">
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                  )}
                </div>
                {evolution ? (
                  <Textarea
                    value={evolution}
                    onChange={(e) => setEvolution(e.target.value)}
                    className="min-h-[160px] max-h-[30dvh] resize-none text-sm"
                  />
                ) : (
                  <Button
                    onClick={generateEvolution}
                    disabled={generating || !transcript}
                    variant="secondary"
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    {generating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando evolução...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Gerar evolução clínica a partir da transcrição</>
                    )}
                  </Button>
                )}
                {evolution && (
                  <Button
                    onClick={generateEvolution}
                    disabled={generating}
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Refazer evolução
                  </Button>
                )}
                {evolution && patientId && clinicId && (
                  <Button
                    onClick={saveAsEvolution}
                    disabled={saving || !!savedId}
                    size="sm"
                    className="w-full gap-1.5"
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                    ) : savedId ? (
                      <>✓ Salva no histórico</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" /> Salvar como evolução do paciente (hoje)</>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {cached ? '✓ Já transcrita anteriormente' : transcript ? '✓ Nova transcrição salva' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyAll} disabled={!transcript || loading} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copiar transcrição
            </Button>
            <Button variant="ghost" size="sm" onClick={() => runTranscription(true)} disabled={loading} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Refazer transcrição
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}