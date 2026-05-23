import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Video, Loader2, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { TelehealthSessionsList } from './TelehealthSessionsList';
import { Separator } from '@/components/ui/separator';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  appointmentId?: string;
  clinicId?: string | null;
  patientName?: string;
  therapySessionId?: string;
}

export function StartTelehealthDialog({ open, onOpenChange, patientId, appointmentId, clinicId, patientName, therapySessionId }: Props) {
  const navigate = useNavigate();
  // 'none' = não grava | 'audio' = somente áudio (padrão, mais leve, foco em transcrição)
  // 'video' = áudio + vídeo (consome muito mais armazenamento)
  const [recordMode, setRecordMode] = useState<'none' | 'audio' | 'video'>('audio');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ session_id: string; room_url: string; patient_token: string } | null>(null);

  const patientLink = result
    ? `${window.location.origin}/teleatendimento/${result.patient_token}`
    : '';

  async function createRoom() {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-video-room', {
        body: {
          patient_id: patientId,
          appointment_id: appointmentId,
          clinic_id: clinicId,
          recording_enabled: recordMode !== 'none',
          recording_layout: recordMode === 'video' ? 'video' : 'audio',
          therapy_session_id: therapySessionId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      setResult(data as any);
      if (recordMode !== 'none' && (data as any)?.recording_fallback === 'plan_unsupported') {
        toast.warning('Gravação indisponível no plano atual do provedor de vídeo. Sala criada sem gravação.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar sala');
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setRecordMode('audio');
    setResult(null);
    setCreating(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function copyLink() {
    navigator.clipboard.writeText(patientLink);
    toast.success('Link copiado!');
  }

  function openRoom() {
    if (result) {
      onOpenChange(false);
      // Usa navegação SPA para que a chamada use o PersistentTelehealthRoom
      // (PiP global). Assim, ao sair da rota a chamada continua viva como
      // mini-janela, e o encerramento registra status='ended' corretamente.
      navigate(`/teleatendimento/sala/${result.session_id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Iniciar Teleatendimento
          </DialogTitle>
          <DialogDescription>
            {patientName ? `Com ${patientName}` : 'Crie uma sala segura para o atendimento online.'}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <Label className="font-medium text-sm">Modo de gravação</Label>
              <RadioGroup
                value={recordMode}
                onValueChange={(v) => setRecordMode(v as 'none' | 'audio' | 'video')}
                className="space-y-1.5"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="none" id="rec-none" className="mt-0.5" />
                  <Label htmlFor="rec-none" className="cursor-pointer font-normal leading-snug">
                    Não gravar
                    <span className="block text-[11px] text-muted-foreground">Sessão sem registro — não gera transcrição.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="audio" id="rec-audio" className="mt-0.5" />
                  <Label htmlFor="rec-audio" className="cursor-pointer font-normal leading-snug">
                    Gravar apenas áudio <span className="text-[10px] text-primary font-medium">(recomendado)</span>
                    <span className="block text-[11px] text-muted-foreground">Mais leve, mais privado e suficiente para transcrição e resumo IA.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="video" id="rec-video" className="mt-0.5" />
                  <Label htmlFor="rec-video" className="cursor-pointer font-normal leading-snug">
                    Gravar vídeo + áudio
                    <span className="block text-[11px] text-muted-foreground">Consome bem mais armazenamento. Use só quando o vídeo for indispensável.</span>
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground pt-1">A gravação fica pronta ~2 min após encerrar a chamada.</p>
            </div>

            {recordMode !== 'none' && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>LGPD:</strong> O paciente deve consentir explicitamente a gravação ao entrar na
                  sala. Sem o consentimento dele, a gravação não será iniciada.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={createRoom} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando sala...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Criar sala
                  </>
                )}
              </Button>
            </DialogFooter>

            <Separator />
            <TelehealthSessionsList patientId={patientId} patientName={patientName} clinicId={clinicId} />
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-xs">
                Sala criada! Envie o link abaixo ao paciente (WhatsApp, e-mail) e entre na sua sala
                quando estiver pronto.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Link do paciente</Label>
              <div className="flex gap-2">
                <Input value={patientLink} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
              <Button onClick={openRoom}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Entrar na sala
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}