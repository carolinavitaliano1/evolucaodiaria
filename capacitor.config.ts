import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ad55da4c1b2d43309c3eff93b7191829',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://ad55da4c-1b2d-4330-9c3e-ff93b7191829.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    }
  }
};

export default config;
