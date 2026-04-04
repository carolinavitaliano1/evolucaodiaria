import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PortalAccount {
  id: string;
  patient_id: string;
  therapist_user_id: string;
  patient_email: string;
  status: string;
  access_type: string;
  access_label: string | null;
  permissions: Record<string, boolean>;
}

export interface PortalPatient {
  id: string;
  name: string;
  clinic_id: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  payment_due_day: number | null;
  payment_value: number | null;
  payment_type: string | null;
}

export interface PortalMessage {
  id: string;
  patient_id: string;
  therapist_user_id: string;
  sender_type: string;
  content: string;
  message_type: string;
  read_by_patient: boolean;
  read_by_therapist: boolean;
  created_at: string;
}

interface PortalContextType {
  portalAccount: PortalAccount | null;
  patient: PortalPatient | null;
  messages: PortalMessage[];
  loading: boolean;
  isPortalUser: boolean;
  unreadCount: number;
  sendMessage: (content: string, type?: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  markMessagesAsRead: () => Promise<void>;
  refreshPortal: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [portalAccount, setPortalAccount] = useState<PortalAccount | null>(null);
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const portalAccountRef = useRef<PortalAccount | null>(null);

  const loadMessages = useCallback(async (accountId?: string) => {
    const aid = accountId || portalAccountRef.current?.id;
    if (!aid) return;
    const { data } = await supabase
      .from('portal_messages')
      .select('*')
      .eq('portal_account_id', aid)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as PortalMessage[]);
  }, []);

  const setupRealtime = useCallback((accountId: string) => {
    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `portal-messages-${accountId}-${user?.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portal_messages',
          filter: `portal_account_id=eq.${accountId}`,
        },
        () => {
          loadMessages(accountId);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadMessages(accountId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          loadMessages(accountId);
        }
      });

    channelRef.current = channel;
  }, [user?.id, loadMessages]);

  const loadPortalData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: account } = await supabase
        .from('patient_portal_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (account) {
        setPortalAccount(account as PortalAccount);
        portalAccountRef.current = account as PortalAccount;

        const [{ data: patientData }, { data: msgs }] = await Promise.all([
          supabase
            .from('patients')
            .select('id, name, clinic_id, email, phone, whatsapp, payment_due_day, payment_value, payment_type')
            .eq('id', account.patient_id)
            .single(),
          supabase
            .from('portal_messages')
            .select('*')
            .eq('patient_id', account.patient_id)
            .order('created_at', { ascending: true }),
        ]);

        if (patientData) setPatient(patientData as PortalPatient);
        if (msgs) setMessages(msgs as PortalMessage[]);

        // Setup realtime subscription for messages
        setupRealtime(account.patient_id);
      } else {
        setPortalAccount(null);
        portalAccountRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [user, setupRealtime]);

  useEffect(() => {
    loadPortalData();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadPortalData]);

  const sendMessage = async (content: string, type = 'message') => {
    if (!portalAccountRef.current) return;
    await supabase.from('portal_messages').insert({
      patient_id: portalAccountRef.current.patient_id,
      therapist_user_id: portalAccountRef.current.therapist_user_id,
      sender_type: 'patient',
      content,
      message_type: type,
      read_by_patient: true,
      read_by_therapist: false,
    });
    // Realtime will trigger loadMessages automatically
  };

  const markMessagesAsRead = async () => {
    if (!portalAccountRef.current) return;
    await supabase
      .from('portal_messages')
      .update({ read_by_patient: true })
      .eq('patient_id', portalAccountRef.current.patient_id)
      .eq('sender_type', 'therapist')
      .eq('read_by_patient', false);
    await loadMessages();
  };

  const unreadCount = messages.filter(m => m.sender_type === 'therapist' && !m.read_by_patient).length;

  return (
    <PortalContext.Provider value={{
      portalAccount,
      patient,
      messages,
      loading,
      isPortalUser: !!portalAccount,
      unreadCount,
      sendMessage,
      loadMessages: () => loadMessages(),
      markMessagesAsRead,
      refreshPortal: loadPortalData,
    }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error('usePortal must be used within PortalProvider');
  return context;
}
