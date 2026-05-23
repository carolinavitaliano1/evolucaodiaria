import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTelehealthCall } from '@/contexts/TelehealthCallContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TelehealthRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { call, startCall } = useTelehealthCall();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!sessionId) throw new Error('Sessão inválida');
        // Já está nessa chamada (voltou via PiP): apenas renderiza a sala
        if (call && call.sessionId === sessionId) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('video_sessions')
          .select('daily_room_url, status, therapist_user_id')
          .eq('id', sessionId)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Sessão não encontrada');
        if (cancelled) return;
        await supabase
          .from('video_sessions')
          .update({ status: 'active', started_at: new Date().toISOString() })
          .eq('id', sessionId);
        startCall({
          sessionId,
          roomUrl: data.daily_room_url,
          userName: 'Terapeuta',
          onLeft: async () => {
            await supabase
              .from('video_sessions')
              .update({ status: 'ended', ended_at: new Date().toISOString() })
              .eq('id', sessionId);
          },
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar sala');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (user) load();
    return () => { cancelled = true; };
  }, [sessionId, user, call, startCall]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-center text-muted-foreground">{error || 'Sala indisponível'}</p>
        <Button onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  // A chamada é renderizada pelo <PersistentTelehealthRoom /> montado no App.
  // Esta página apenas funciona como "âncora" — quando o usuário está nesta rota,
  // o componente persistente expande para tela cheia. Ao navegar para outra
  // página, a chamada continua viva como uma mini janela flutuante.
  return <div className="fixed inset-0 bg-black" />;
}