import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PrivateAppointment {
  id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  service_id?: string;
  date: string;
  time: string;
  price: number;
  status: string;
  notes?: string;
  paid?: boolean;
  created_at: string;
}

export function usePrivateAppointments() {
  const [privateAppointments, setPrivateAppointments] = useState<PrivateAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('private_appointments')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setPrivateAppointments(data || []);
    } catch (error) {
      console.error('Error loading private appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const getAppointmentsForDate = (dateStr: string) => {
    return privateAppointments.filter(a => a.date === dateStr);
  };

  const getMonthlyAppointments = (month: number, year: number) => {
    return privateAppointments.filter(a => {
      const date = new Date(a.date);
      return date.getMonth() === month && date.getFullYear() === year;
    });
  };

  return {
    privateAppointments,
    loading,
    getAppointmentsForDate,
    getMonthlyAppointments,
    refetch: loadAppointments,
  };
}
