import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadSupportCount() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_support_admin')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(!!(data as any)?.is_support_admin));
  }, [user]);

  const fetchCount = useCallback(async () => {
    if (!user) return;

    if (isAdmin) {
      // Admin: count non-admin messages after lastSeen, from open chats only
      const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(adminLastSeenKey) ?? '1970-01-01';

      // Get latest closed session per user to exclude closed chats
      const { data: sessions } = await supabase
        .from('support_chat_sessions')
        .select('user_id, closed_at')
        .order('closed_at', { ascending: false });

      const closedMap = new Map<string, string>();
      for (const s of (sessions || []) as any[]) {
        if (!closedMap.has(s.user_id)) closedMap.set(s.user_id, s.closed_at);
      }

      const { data: msgs } = await supabase
        .from('support_messages')
        .select('user_id, created_at, is_admin_reply')
        .eq('is_admin_reply', false)
        .gt('created_at', lastSeen);

      // Only count messages from open conversations
      const count = (msgs || []).filter((m: any) => {
        const closedAt = closedMap.get(m.user_id);
        if (!closedAt) return true;
        return new Date(m.created_at) > new Date(closedAt);
      }).length;

      setUnreadCount(count);
    } else {
      // User: count admin replies after lastSeen
      const lastSeenKey = `support_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(lastSeenKey) ?? '1970-01-01';

      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_admin_reply', true)
        .gt('created_at', lastSeen);
      setUnreadCount(count ?? 0);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: refresh badge when a new support message arrives
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sidebar-support-badge-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }),
      }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, fetchCount]);

  // Realtime: zero user badge when their chat session is closed
  useEffect(() => {
    if (!user || isAdmin) return;
    const channel = supabase
      .channel(`support-session-close-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_chat_sessions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        const lastSeenKey = `support_last_seen_${user.id}`;
        localStorage.setItem(lastSeenKey, new Date().toISOString());
        setUnreadCount(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  /** Call when user opens /suporte — zeros badge immediately */
  const markSupportSeen = useCallback(() => {
    if (!user || isAdmin) return;
    const lastSeenKey = `support_last_seen_${user.id}`;
    localStorage.setItem(lastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user, isAdmin]);

  /** Call when admin opens /suporte or selects a conversation */
  const markAdminSeen = useCallback(() => {
    if (!user) return;
    const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
    localStorage.setItem(adminLastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user]);

  return { unreadCount, isAdmin, markSupportSeen, markAdminSeen };
}
