import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Smartphone, Clock, Calendar, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications } from '@/hooks/useNotifications';

const REMINDER_OPTIONS = [
  { value: '5', label: '5 minutos antes' },
  { value: '10', label: '10 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
];

export function NotificationSettings() {
  const {
    isNative,
    hasPermission,
    isLoading,
    pendingCount,
    requestPermission,
    scheduleAllTodayAppointments,
    cancelAll,
  } = useNotifications();

  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [autoSchedule, setAutoSchedule] = useState(true);

  // Load saved preferences
  useEffect(() => {
    const savedMinutes = localStorage.getItem('reminder_minutes');
    const savedAutoSchedule = localStorage.getItem('auto_schedule_reminders');
    if (savedMinutes) setReminderMinutes(savedMinutes);
    if (savedAutoSchedule !== null) setAutoSchedule(savedAutoSchedule === 'true');
  }, []);

  // Auto-schedule on permission grant
  useEffect(() => {
    if (hasPermission && autoSchedule && !isLoading) {
      scheduleAllTodayAppointments();
    }
  }, [hasPermission, autoSchedule, isLoading]);

  const handleReminderChange = (value: string) => {
    setReminderMinutes(value);
    localStorage.setItem('reminder_minutes', value);
  };

  const handleAutoScheduleChange = (checked: boolean) => {
    setAutoSchedule(checked);
    localStorage.setItem('auto_schedule_reminders', String(checked));
  };

  // Don't show anything if not on native app
  if (!isNative) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium">Lembretes</CardTitle>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingCount} ativo{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
          <div className="flex items-center gap-3">
            {hasPermission ? (
              <div className="p-2 rounded-full bg-success/10">
                <Bell className="h-4 w-4 text-success" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-muted">
                <BellOff className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div>
              <Label htmlFor="notifications-enabled" className="text-sm font-medium">
                Notificações
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasPermission ? 'Ativadas' : 'Toque para ativar'}
              </p>
            </div>
          </div>
          <Switch
            id="notifications-enabled"
            checked={hasPermission}
            onCheckedChange={() => {
              if (!hasPermission) {
                requestPermission();
              }
            }}
            disabled={isLoading || hasPermission}
          />
        </div>

        {hasPermission && (
          <>
            {/* Reminder Time Setting */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Antecedência do lembrete</Label>
              </div>
              <Select value={reminderMinutes} onValueChange={handleReminderChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto Schedule Setting */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Agendar automaticamente</Label>
                  <p className="text-xs text-muted-foreground">
                    Criar lembretes ao abrir o app
                  </p>
                </div>
              </div>
              <Switch
                checked={autoSchedule}
                onCheckedChange={handleAutoScheduleChange}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center gap-2"
                onClick={scheduleAllTodayAppointments}
              >
                <BellRing className="h-4 w-4" />
                Agendar lembretes de hoje
              </Button>
              
              {pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={cancelAll}
                >
                  <BellOff className="h-4 w-4" />
                  Cancelar lembretes
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
