import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { useTelehealthCall } from '@/contexts/TelehealthCallContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Maximize2, PhoneOff } from 'lucide-react';

/**
 * Mantém a chamada do Daily montada globalmente para que o terapeuta possa
 * navegar entre páginas (ex.: prontuário, anotações) sem perder a conexão.
 *
 * - Na rota /teleatendimento/sala/:id → exibe em tela cheia.
 * - Em qualquer outra rota → exibe como mini janela flutuante (PiP) no canto.
 * - O <div> do iframe é o mesmo nó DOM nos dois modos — só o container muda
 *   de classe, então o iframe do Daily nunca é destruído ao mudar de rota.
 */
export function PersistentTelehealthRoom() {
  const { call, endCall } = useTelehealthCall();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<DailyCall | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!call) {
      if (frameRef.current) {
        try { frameRef.current.destroy(); } catch {}
        frameRef.current = null;
        currentSessionRef.current = null;
      }
      return;
    }

    // Já estamos na mesma sessão: mantém o frame ativo
    if (frameRef.current && currentSessionRef.current === call.sessionId) return;

    // Sessão diferente: destrói a anterior antes de criar a nova
    if (frameRef.current) {
      try { frameRef.current.destroy(); } catch {}
      frameRef.current = null;
    }
    if (!containerRef.current) return;

    const frame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '0' },
      showLeaveButton: true,
      showFullscreenButton: true,
    });
    frame.on('left-meeting', async () => {
      await call.onLeft?.();
      const returnPath = call.returnPath;
      const wasOnRoom = window.location.pathname.startsWith('/teleatendimento/sala/');
      endCall();
      if (returnPath && wasOnRoom) {
        navigate(returnPath, { replace: true });
      }
    });
    // Inicia gravação automática (geralmente audio-only) após entrar na sala.
    if (call.recordingLayout) {
      const layoutPreset = call.recordingLayout;
      frame.on('joined-meeting', () => {
        try {
          // @ts-ignore — startRecording aceita layout no Daily prebuilt
          frame.startRecording({ layout: { preset: layoutPreset } });
        } catch (e) {
          console.warn('Falha ao iniciar gravação automática:', e);
        }
      });
    }
    frame.join({ url: call.roomUrl, userName: call.userName || 'Participante' }).catch((e) => {
      console.error('Failed to join Daily room:', e);
    });
    frameRef.current = frame;
    currentSessionRef.current = call.sessionId;
  }, [call, endCall]);

  if (!call) return null;

  const onRoomRoute = location.pathname === `/teleatendimento/sala/${call.sessionId}`;

  return (
    <div
      className={
        onRoomRoute
          ? 'fixed inset-0 z-40 bg-black'
          : 'fixed bottom-4 right-4 z-50 w-72 h-44 rounded-lg overflow-hidden shadow-2xl border-2 border-primary/40 bg-black'
      }
    >
      <div ref={containerRef} className="w-full h-full" />
      {onRoomRoute && (
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 shadow-md"
            onClick={() => navigate(call.returnPath || '/dashboard')}
            title="Voltar ao app sem encerrar"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao app
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 gap-1.5 shadow-md"
            onClick={async () => {
              if (confirm('Encerrar a chamada?')) {
                try { await frameRef.current?.leave(); } catch {}
                await call.onLeft?.();
                endCall();
                navigate(call.returnPath || '/dashboard', { replace: true });
              }
            }}
            title="Encerrar chamada e salvar no histórico"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Encerrar sessão
          </Button>
        </div>
      )}
      {!onRoomRoute && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-md"
            onClick={() => navigate(`/teleatendimento/sala/${call.sessionId}`)}
            title="Voltar para a sala em tela cheia"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 shadow-md"
            onClick={() => {
              if (confirm('Encerrar a chamada?')) {
                try { frameRef.current?.leave(); } catch {}
                void call.onLeft?.();
                endCall();
                if (call.returnPath) navigate(call.returnPath, { replace: true });
              }
            }}
            title="Encerrar chamada"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      {!onRoomRoute && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-1 px-2 text-center pointer-events-none">
          Chamada em andamento — clique em ⤢ para voltar
        </div>
      )}
    </div>
  );
}