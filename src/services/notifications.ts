import { Appointment } from '@/types';

export interface NotificationConfig {
  appointmentId: string;
  patientName: string;
  clinicName: string;
  date: string;
  time: string;
  minutesBefore?: number;
}

// Capacitor was removed; the app currently runs only on the web.
export const isNativePlatform = () => false;

// Request notification permissions
export const requestNotificationPermission = async (): Promise<boolean> => false;

// Check notification permissions
export const checkNotificationPermission = async (): Promise<boolean> => false;

export const scheduleAppointmentNotification = async (
  _config: NotificationConfig
): Promise<boolean> => false;

export const cancelAppointmentNotification = async (
  _appointmentId: string
): Promise<boolean> => true;

export const cancelAllNotifications = async (): Promise<boolean> => true;

export const getPendingNotifications = async () => [] as any[];

export const scheduleAppointmentsForDay = async (
  _appointments: Appointment[],
  _getPatientName: (patientId: string) => string,
  _getClinicName: (clinicId: string) => string,
  _minutesBefore: number = 5
): Promise<number> => 0;

export const setupNotificationListeners = (
  _onNotificationReceived?: (notification: any) => void,
  _onNotificationActionPerformed?: (action: any) => void
) => {
  return () => {};
};
