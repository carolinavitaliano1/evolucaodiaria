import { useState, useEffect, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Registers device push token with the backend so the server
 * can send push notifications when support replies.
 */
export function usePushRegistration() {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);

  const registerToken = useCallback(async (token: string) => {
    if (!user) return;
    const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
    await supabase.from('push_tokens').upsert(
      { user_id: user.id, token, platform },
      { onConflict: 'user_id,token' }
    );
  }, [user]);

  useEffect(() => {
    if (!user || registered) return;
    if (!Capacitor.isNativePlatform()) return; // Only runs on native iOS/Android

    const setup = async () => {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') return;

      await PushNotifications.register();
      setRegistered(true);
    };

    // Listen for registration token
    const regListener = PushNotifications.addListener('registration', async ({ value }) => {
      await registerToken(value);
    });

    setup();

    return () => {
      regListener.then(l => l.remove());
    };
  }, [user, registered, registerToken]);
}
