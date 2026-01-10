import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Appointment } from '@/types';

export interface NotificationConfig {
  appointmentId: string;
  patientName: string;
  clinicName: string;
  date: string;
  time: string;
  minutesBefore?: number;
}

// Check if we're running on a native platform
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

// Request notification permissions
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('Notifications only work on native platforms');
    return false;
  }

  try {
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Check notification permissions
export const checkNotificationPermission = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return false;
  }
};

// Generate a unique notification ID from appointment ID
const generateNotificationId = (appointmentId: string): number => {
  let hash = 0;
  for (let i = 0; i < appointmentId.length; i++) {
    const char = appointmentId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Schedule a notification for an appointment
export const scheduleAppointmentNotification = async (
  config: NotificationConfig
): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('Scheduling notification (web mock):', config);
    return true;
  }

  try {
    const minutesBefore = config.minutesBefore ?? 5;
    
    // Parse date and time
    const [hours, minutes] = config.time.split(':').map(Number);
    const appointmentDate = new Date(config.date);
    appointmentDate.setHours(hours, minutes, 0, 0);
    
    // Calculate notification time (X minutes before)
    const notificationTime = new Date(appointmentDate.getTime() - minutesBefore * 60 * 1000);
    
    // Don't schedule if the time has already passed
    if (notificationTime <= new Date()) {
      console.log('Notification time has already passed');
      return false;
    }

    const notificationId = generateNotificationId(config.appointmentId);

    const scheduleOptions: ScheduleOptions = {
      notifications: [
        {
          id: notificationId,
          title: '🔔 Atendimento em breve!',
          body: `${config.patientName} - ${config.time} na ${config.clinicName}`,
          schedule: { at: notificationTime },
          sound: 'beep.wav',
          smallIcon: 'ic_stat_icon_config_sample',
          largeIcon: 'ic_launcher',
          actionTypeId: 'APPOINTMENT_REMINDER',
          extra: {
            appointmentId: config.appointmentId,
            patientName: config.patientName,
            clinicName: config.clinicName,
          },
        },
      ],
    };

    await LocalNotifications.schedule(scheduleOptions);
    console.log('Notification scheduled for:', notificationTime);
    return true;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
};

// Cancel a specific notification
export const cancelAppointmentNotification = async (
  appointmentId: string
): Promise<boolean> => {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const notificationId = generateNotificationId(appointmentId);
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    return true;
  } catch (error) {
    console.error('Error canceling notification:', error);
    return false;
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    return true;
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    return false;
  }
};

// Get all pending notifications
export const getPendingNotifications = async () => {
  if (!isNativePlatform()) {
    return [];
  }

  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications;
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    return [];
  }
};

// Schedule notifications for all appointments on a given day
export const scheduleAppointmentsForDay = async (
  appointments: Appointment[],
  getPatientName: (patientId: string) => string,
  getClinicName: (clinicId: string) => string,
  minutesBefore: number = 5
): Promise<number> => {
  let scheduledCount = 0;

  for (const appointment of appointments) {
    const success = await scheduleAppointmentNotification({
      appointmentId: appointment.id,
      patientName: getPatientName(appointment.patientId),
      clinicName: getClinicName(appointment.clinicId),
      date: appointment.date,
      time: appointment.time,
      minutesBefore,
    });

    if (success) {
      scheduledCount++;
    }
  }

  return scheduledCount;
};

// Setup notification listeners
export const setupNotificationListeners = (
  onNotificationReceived?: (notification: any) => void,
  onNotificationActionPerformed?: (action: any) => void
) => {
  if (!isNativePlatform()) {
    return () => {};
  }

  const receivedListener = LocalNotifications.addListener(
    'localNotificationReceived',
    (notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  const actionListener = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action) => {
      console.log('Notification action performed:', action);
      onNotificationActionPerformed?.(action);
    }
  );

  // Return cleanup function
  return () => {
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
};
