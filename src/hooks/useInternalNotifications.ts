import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface InternalNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  patient_name: string | null;
  date_ref: string | null;
  read: boolean;
  created_at: string;
}

export function useInternalNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('internal_notifications')
      .select('*')
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data as InternalNotification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    await supabase
      .from('internal_notifications')
      .update({ read: true })
      .eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('internal_notifications')
      .update({ read: true })
      .eq('recipient_user_id', user.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [user]);

  const dismiss = useCallback(async (id: string) => {
    await supabase
      .from('internal_notifications')
      .delete()
      .eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, dismiss, refresh: load };
}
