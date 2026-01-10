import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';

interface MiniCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export function MiniCalendar({ onDateSelect }: MiniCalendarProps) {
  const { selectedDate, setSelectedDate, appointments } = useApp();
  const [viewDate, setViewDate] = useState(selectedDate);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const hasAppointments = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.some(a => a.date === dateStr);
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h3 className="font-semibold text-foreground capitalize">
          {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const hasApts = hasAppointments(day);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={cn(
                'relative p-2 text-sm rounded-lg transition-all hover:bg-secondary',
                isToday(day) && !isSelected && 'bg-primary/10 font-bold text-primary',
                isSelected && 'gradient-primary text-primary-foreground font-semibold shadow-glow',
                !isSelected && !isToday(day) && 'text-foreground'
              )}
            >
              {format(day, 'd')}
              {hasApts && !isSelected && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
