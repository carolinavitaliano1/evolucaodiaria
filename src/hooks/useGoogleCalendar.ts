import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string;
  source: 'google';
}

interface UseGoogleCalendarReturn {
  connected: boolean;
  loading: boolean;
  events: GoogleCalendarEvent[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refetch: (timeMin?: string, timeMax?: string) => Promise<void>;
}

export function useGoogleCalendar(viewDate?: Date): UseGoogleCalendarReturn {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const fetchEvents = useCallback(async (timeMin?: string, timeMax?: string) => {
    const session = await getSession();
    if (!session) return;

    const now = viewDate || new Date();
    const start = timeMin || startOfMonth(now).toISOString();
    const end = timeMax || endOfMonth(now).toISOString();

    try {
      const res = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        // Pass query params via body since functions.invoke doesn't support query params directly
        body: null,
        method: 'GET',
      } as any);

      // Use fetch directly for query params
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      const data = await response.json();
      setConnected(data.connected ?? false);
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching Google Calendar events:', err);
    }
  }, [viewDate]);

  const checkStatus = useCallback(async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=status`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      setConnected(data.connected ?? false);
      if (data.connected) {
        await fetchEvents();
      }
    } catch (err) {
      console.error('Error checking Google Calendar status:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Re-fetch when viewDate month changes
  useEffect(() => {
    if (connected && viewDate) {
      fetchEvents();
    }
  }, [connected, viewDate?.getMonth(), viewDate?.getFullYear()]);

  // Handle redirect back from OAuth (google_connected=true in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      toast.success('Google Calendar conectado com sucesso!');
      checkStatus();
    }
    if (params.get('google_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      toast.error('Erro ao conectar Google Calendar. Tente novamente.');
    }
  }, []);

  const connect = async () => {
    const session = await getSession();
    if (!session) { toast.error('Faça login primeiro.'); return; }
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=get_auth_url`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Não foi possível iniciar a conexão com o Google.');
      }
    } catch (err) {
      toast.error('Erro ao conectar com o Google.');
    }
  };

  const disconnect = async () => {
    const session = await getSession();
    if (!session) return;
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=disconnect`;
      await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      setConnected(false);
      setEvents([]);
      toast.success('Google Calendar desconectado.');
    } catch (err) {
      toast.error('Erro ao desconectar.');
    }
  };

  return { connected, loading, events, connect, disconnect, refetch: fetchEvents };
}
