import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
}

export function StartTelehealthDialog({ open, onOpenChange, patientId, appointmentId, clinicId, patientName }: Props) {
  const [record, setRecord] = useState(false);
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
          recording_enabled: record,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      setResult(data as any);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar sala');
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setRecord(false);
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
      window.open(`/teleatendimento/sala/${result.session_id}`, '_blank', 'noopener');
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
            <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
              <Checkbox
                id="record"
                checked={record}
                onCheckedChange={(c) => setRecord(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="record" className="cursor-pointer font-medium">
                  Gravar esta sessão
                </Label>
                <p className="text-xs text-muted-foreground">
                  A gravação ficará disponível em ~2 min após encerrar a chamada.
                </p>
              </div>
            </div>

            {record && (
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
            <TelehealthSessionsList patientId={patientId} patientName={patientName} />
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