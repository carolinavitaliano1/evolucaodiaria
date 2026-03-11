import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PortalAccount {
  id: string;
  patient_id: string;
  therapist_user_id: string;
  patient_email: string;
  status: string;
}

export interface PortalPatient {
  id: string;
  name: string;
  clinic_id: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
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

  const loadMessages = useCallback(async (patientId?: string) => {
    const pid = patientId || portalAccount?.patient_id;
    if (!pid) return;
    const { data } = await supabase
      .from('portal_messages')
      .select('*')
      .eq('patient_id', pid)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as PortalMessage[]);
  }, [portalAccount?.patient_id]);

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
        const { data: patientData } = await supabase
          .from('patients')
          .select('id, name, clinic_id, email, phone, whatsapp')
          .eq('id', account.patient_id)
          .single();
        if (patientData) setPatient(patientData as PortalPatient);

        // Load messages
        const { data: msgs } = await supabase
          .from('portal_messages')
          .select('*')
          .eq('patient_id', account.patient_id)
          .order('created_at', { ascending: true });
        if (msgs) setMessages(msgs as PortalMessage[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const sendMessage = async (content: string, type = 'message') => {
    if (!portalAccount) return;
    await supabase.from('portal_messages').insert({
      patient_id: portalAccount.patient_id,
      therapist_user_id: portalAccount.therapist_user_id,
      sender_type: 'patient',
      content,
      message_type: type,
      read_by_patient: true,
      read_by_therapist: false,
    });
    await loadMessages();
  };

  const markMessagesAsRead = async () => {
    if (!portalAccount) return;
    await supabase
      .from('portal_messages')
      .update({ read_by_patient: true })
      .eq('patient_id', portalAccount.patient_id)
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
