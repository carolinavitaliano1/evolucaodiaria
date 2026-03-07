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
      // Admin: count user messages since last seen, only from open chats
      const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(adminLastSeenKey) ?? '1970-01-01';

      // Get all closed sessions to exclude messages from closed chats
      const { data: sessions } = await supabase
        .from('support_chat_sessions')
        .select('user_id, closed_at')
        .order('closed_at', { ascending: false });

      // Build latest closed_at per user
      const closedMap = new Map<string, string>();
      for (const s of (sessions || []) as any[]) {
        if (!closedMap.has(s.user_id)) closedMap.set(s.user_id, s.closed_at);
      }

      const { data: msgs } = await supabase
        .from('support_messages')
        .select('user_id, created_at, is_admin_reply')
        .eq('is_admin_reply', false)
        .gt('created_at', lastSeen);

      // Only count messages from open conversations (no closed session after the message)
      const count = (msgs || []).filter((m: any) => {
        const closedAt = closedMap.get(m.user_id);
        if (!closedAt) return true; // no session = open
        return new Date(m.created_at) > new Date(closedAt); // message came after close = reopened
      }).length;

      setUnreadCount(count);
    } else {
      // User: count admin replies since last seen, but only after the latest chat closure
      // (messages before closure were part of the finished session)
      const lastSeenKey = `support_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(lastSeenKey) ?? '1970-01-01';

      // Get the most recent closed session for this user
      const { data: sessions } = await supabase
        .from('support_chat_sessions')
        .select('closed_at')
        .eq('user_id', user.id)
        .order('closed_at', { ascending: false })
        .limit(1);

      const lastClosedAt = (sessions && sessions.length > 0) ? (sessions[0] as any).closed_at : null;

      // If the chat is currently closed (has a session), no new admin messages to count
      // because the user can't receive new ones while closed
      // We only count messages AFTER the last closure (i.e., from a reopened session)
      const afterDate = lastClosedAt
        ? new Date(Math.max(new Date(lastSeen).getTime(), new Date(lastClosedAt).getTime())).toISOString()
        : lastSeen;

      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_admin_reply', true)
        .gt('created_at', afterDate);
      setUnreadCount(count ?? 0);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: refresh badge when a support message is inserted
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

  // Realtime: clear badge for BOTH user and admin when chat session is closed
  useEffect(() => {
    if (!user) return;
    const filter = isAdmin ? undefined : `user_id=eq.${user.id}`;
    const channel = supabase
      .channel(`support-session-close-${user.id}-${isAdmin ? 'admin' : 'user'}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_chat_sessions',
        ...(filter ? { filter } : {}),
      }, () => {
        // Chat was closed — stamp lastSeen as NOW and zero the badge
        if (isAdmin) {
          const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
          localStorage.setItem(adminLastSeenKey, new Date().toISOString());
        } else {
          const lastSeenKey = `support_last_seen_${user.id}`;
          localStorage.setItem(lastSeenKey, new Date().toISOString());
        }
        setUnreadCount(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  /** Call this when the user opens /suporte or closes the chat */
  const markSupportSeen = useCallback(() => {
    if (!user || isAdmin) return;
    const lastSeenKey = `support_last_seen_${user.id}`;
    localStorage.setItem(lastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user, isAdmin]);

  /** Call this when the admin opens a conversation, replies or closes the chat */
  const markAdminSeen = useCallback(() => {
    if (!user) return;
    // Use user.id directly — don't depend on async isAdmin state
    const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
    localStorage.setItem(adminLastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user]);

  return { unreadCount, isAdmin, markSupportSeen, markAdminSeen };
}
