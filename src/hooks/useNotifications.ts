import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  isNativePlatform,
  requestNotificationPermission,
  checkNotificationPermission,
  scheduleAppointmentNotification,
  cancelAppointmentNotification,
  cancelAllNotifications,
  getPendingNotifications,
  setupNotificationListeners,
  NotificationConfig,
} from '@/services/notifications';
import { useToast } from '@/hooks/use-toast';

interface UseNotificationsReturn {
  isNative: boolean;
  hasPermission: boolean;
  isLoading: boolean;
  pendingCount: number;
  requestPermission: () => Promise<boolean>;
  scheduleForAppointment: (config: Omit<NotificationConfig, 'minutesBefore'>) => Promise<boolean>;
  cancelForAppointment: (appointmentId: string) => Promise<boolean>;
  cancelAll: () => Promise<boolean>;
  scheduleAllTodayAppointments: () => Promise<number>;
  refreshPendingCount: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const { appointments, patients, clinics, selectedDate } = useApp();
  const { toast } = useToast();

  const isNative = isNativePlatform();

  // Get patient name by ID
  const getPatientName = useCallback((patientId: string): string => {
    return patients.find(p => p.id === patientId)?.name ?? 'Paciente';
  }, [patients]);

  // Get clinic name by ID
  const getClinicName = useCallback((clinicId: string): string => {
    return clinics.find(c => c.id === clinicId)?.name ?? 'Clínica';
  }, [clinics]);

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const granted = await checkNotificationPermission();
      setHasPermission(granted);
      setIsLoading(false);
    };
    checkPermission();
  }, []);

  // Setup listeners on mount
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        toast({
          title: notification.title,
          description: notification.body,
        });
      },
      (action) => {
        // Handle notification tap - could navigate to appointment details
        console.log('Notification tapped:', action);
      }
    );

    return cleanup;
  }, [toast]);

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingNotifications();
    setPendingCount(pending.length);
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    const granted = await requestNotificationPermission();
    setHasPermission(granted);
    setIsLoading(false);

    if (granted) {
      toast({
        title: '✅ Notificações ativadas',
        description: 'Você receberá alertas antes dos atendimentos.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Permissão negada',
        description: 'Ative as notificações nas configurações do dispositivo.',
      });
    }

    return granted;
  }, [toast]);

  // Schedule notification for a specific appointment
  const scheduleForAppointment = useCallback(async (
    config: Omit<NotificationConfig, 'minutesBefore'>
  ): Promise<boolean> => {
    const success = await scheduleAppointmentNotification({
      ...config,
      minutesBefore: 5, // Default 5 minutes before
    });

    if (success) {
      await refreshPendingCount();
      toast({
        title: '🔔 Lembrete agendado',
        description: `Você será notificado 5 min antes do atendimento de ${config.patientName}.`,
      });
    }

    return success;
  }, [refreshPendingCount, toast]);

  // Cancel notification for a specific appointment
  const cancelForAppointment = useCallback(async (
    appointmentId: string
  ): Promise<boolean> => {
    const success = await cancelAppointmentNotification(appointmentId);
    if (success) {
      await refreshPendingCount();
    }
    return success;
  }, [refreshPendingCount]);

  // Cancel all notifications
  const cancelAll = useCallback(async (): Promise<boolean> => {
    const success = await cancelAllNotifications();
    if (success) {
      setPendingCount(0);
      toast({
        title: 'Notificações canceladas',
        description: 'Todos os lembretes foram removidos.',
      });
    }
    return success;
  }, [toast]);

  // Schedule notifications for all of today's appointments
  const scheduleAllTodayAppointments = useCallback(async (): Promise<number> => {
    const today = selectedDate.toISOString().split('T')[0];
    const todayAppointments = appointments.filter(a => a.date === today);

    let scheduledCount = 0;

    for (const appointment of todayAppointments) {
      const success = await scheduleAppointmentNotification({
        appointmentId: appointment.id,
        patientName: getPatientName(appointment.patientId),
        clinicName: getClinicName(appointment.clinicId),
        date: appointment.date,
        time: appointment.time,
        minutesBefore: 5,
      });

      if (success) {
        scheduledCount++;
      }
    }

    await refreshPendingCount();

    if (scheduledCount > 0) {
      toast({
        title: '🔔 Lembretes agendados',
        description: `${scheduledCount} notificação(ões) para hoje.`,
      });
    }

    return scheduledCount;
  }, [appointments, selectedDate, getPatientName, getClinicName, refreshPendingCount, toast]);

  return {
    isNative,
    hasPermission,
    isLoading,
    pendingCount,
    requestPermission,
    scheduleForAppointment,
    cancelForAppointment,
    cancelAll,
    scheduleAllTodayAppointments,
    refreshPendingCount,
  };
}
