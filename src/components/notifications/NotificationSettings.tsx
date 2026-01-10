import { Bell, BellOff, BellRing, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

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

  if (!isNative) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Notificações Nativas</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As notificações de atendimento funcionam apenas no app nativo instalado no seu celular.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Exporte o projeto para GitHub e instale no seu dispositivo para receber alertas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Notificações de Atendimento</CardTitle>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary">
              {pendingCount} agendada{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription>
          Receba alertas 5 minutos antes de cada atendimento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasPermission ? (
              <Bell className="h-5 w-5 text-green-600" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="notifications-enabled">Notificações</Label>
              <p className="text-sm text-muted-foreground">
                {hasPermission ? 'Ativadas' : 'Desativadas'}
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

        {/* Action Buttons */}
        {hasPermission && (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={scheduleAllTodayAppointments}
            >
              <BellRing className="h-4 w-4" />
              Agendar lembretes de hoje
            </Button>
            
            {pendingCount > 0 && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={cancelAll}
              >
                <BellOff className="h-4 w-4" />
                Cancelar todos os lembretes
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
