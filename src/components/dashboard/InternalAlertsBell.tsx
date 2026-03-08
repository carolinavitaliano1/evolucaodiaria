import { Bell, X, CheckCheck, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function InternalAlertsBell() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useInternalNotifications();
  const [open, setOpen] = useState(false);

  // Always render so the bell is visible even when there are no notifications yet

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative w-9 h-9">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Alertas Internos</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="w-3 h-3" />
              Marcar todos
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={cn(
                  'flex gap-3 px-4 py-3 transition-colors',
                  !n.read && 'bg-warning/5'
                )}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="shrink-0 mt-0.5">
                  {n.type === 'compliance_alert' || n.type === 'compliance_daily' ? (
                    <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold text-foreground', !n.read && 'text-warning')}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    {format(parseISO(n.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    {!n.read && (
                      <span className="ml-1 w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 w-6 h-6 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
