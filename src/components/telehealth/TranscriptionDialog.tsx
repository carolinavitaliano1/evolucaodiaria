import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recordingId: string | null;
  recordingLabel?: string;
}

export function TranscriptionDialog({ open, onOpenChange, recordingId, recordingLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [cached, setCached] = useState(false);

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
      runTranscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordingId]);

  function copyAll() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    toast.success('Texto copiado');
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

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              Transcrevendo áudio... pode levar alguns minutos.
            </div>
          ) : (
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Sem texto."
              className="min-h-[300px] max-h-[55dvh] resize-none font-mono text-sm"
            />
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {cached ? '✓ Já transcrita anteriormente' : transcript ? '✓ Nova transcrição salva' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyAll} disabled={!transcript || loading} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copiar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => runTranscription(true)} disabled={loading} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Refazer
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}