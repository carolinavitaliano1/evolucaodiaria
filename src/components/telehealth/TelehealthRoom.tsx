import { useEffect, useRef } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface Props {
  roomUrl: string;
  userName?: string;
  onLeft?: () => void;
}

/**
 * Embeds a Daily.co room inside the app via the prebuilt iframe.
 * Uses a module-level singleton ref to avoid double-mounting in React StrictMode.
 */
let activeFrame: DailyCall | null = null;

export function TelehealthRoom({ roomUrl, userName, onLeft }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup any previous instance globally
    if (activeFrame) {
      try { activeFrame.destroy(); } catch {}
      activeFrame = null;
    }

    const frame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '0',
      },
      showLeaveButton: true,
      showFullscreenButton: true,
    });
    activeFrame = frame;

    frame.on('left-meeting', () => {
      onLeft?.();
    });

    frame.join({ url: roomUrl, userName: userName || 'Participante' }).catch((e) => {
      console.error('Failed to join Daily room:', e);
    });

    return () => {
      try { frame.destroy(); } catch {}
      if (activeFrame === frame) activeFrame = null;
    };
  }, [roomUrl, userName, onLeft]);

  return <div ref={containerRef} className="w-full h-full" />;
}