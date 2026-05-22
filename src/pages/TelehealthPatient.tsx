import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TelehealthRoom } from '@/components/telehealth/TelehealthRoom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Video, ShieldAlert, AlertCircle } from 'lucide-react';

interface SessionInfo {
  id: string;
  daily_room_url: string;
  status: string;
  recording_enabled: boolean;
  patient_consented_at: string | null;
  patient_name: string;
  therapist_name: string;
}

export default function TelehealthPatient() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [consent, setConsent] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (!token) throw new Error('Link inválido');
        const { data, error } = await supabase.rpc('get_video_session_for_patient', { _token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error('Esta sala não está mais disponível.');
        setSession(row as SessionInfo);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar sala');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleJoin() {
    if (!session || !token) return;
    if (session.recording_enabled) {
      if (!consent) return;
      await supabase.rpc('record_video_consent', { _token: token });
    }
    setJoined(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-center text-muted-foreground">{error || 'Sala indisponível'}</p>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="fixed inset-0 bg-black">
        <TelehealthRoom
          roomUrl={session.daily_room_url}
          userName={session.patient_name || 'Paciente'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Teleatendimento</h1>
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{session.patient_name}</strong>! Você foi convidado(a) para uma sessão online
            com <strong>{session.therapist_name}</strong>.
          </p>
        </div>

        {session.recording_enabled && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>Esta sessão será gravada</strong> para fins clínicos e ficará armazenada de forma
                segura, acessível apenas ao seu terapeuta.
              </p>
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(c) => setConsent(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="cursor-pointer text-xs leading-relaxed">
                  Eu autorizo a gravação desta sessão de atendimento.
                </Label>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleJoin}
          disabled={session.recording_enabled && !consent}
          className="w-full"
          size="lg"
        >
          <Video className="w-4 h-4 mr-2" />
          Entrar na sala
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Você precisará permitir o uso do microfone e da câmera do seu dispositivo.
        </p>
      </div>
    </div>
  );
}