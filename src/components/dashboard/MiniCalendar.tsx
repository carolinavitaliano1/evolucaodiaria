import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { EventDialog } from '@/components/calendar/EventDialog';
import { supabase } from '@/integrations/supabase/client';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

interface MiniCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export function MiniCalendar({ onDateSelect }: MiniCalendarProps) {
  const { selectedDate, setSelectedDate, appointments } = useApp();
  const [viewDate, setViewDate] = useState(selectedDate);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [clickedDate, setClickedDate] = useState<Date>(selectedDate);
  const [eventDates, setEventDates] = useState<string[]>([]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  useEffect(() => {
    loadEventDates();
  }, [viewDate]);

  async function loadEventDates() {
    try {
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');
      
      const { data } = await supabase
        .from('events')
        .select('date')
        .eq('user_id', DEMO_USER_ID)
        .gte('date', startStr)
        .lte('date', endStr);

      if (data) {
        setEventDates(data.map(e => e.date));
      }
    } catch (error) {
      console.error('Error loading event dates:', error);
    }
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setClickedDate(date);
    setEventDialogOpen(true);
    onDateSelect?.(date);
  };

  const hasAppointments = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.some(a => a.date === dateStr);
  };

  const hasEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return eventDates.includes(dateStr);
  };

  return (
    <>
      <div className="bg-card rounded-xl p-4 border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <h3 className="font-medium text-foreground capitalize text-sm">
            {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="h-7 w-7"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map((day, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-0.5">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const hasApts = hasAppointments(day);
            const hasEvts = hasEvents(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                className={cn(
                  'relative p-1.5 text-xs rounded-md transition-colors hover:bg-accent',
                  isToday(day) && !isSelected && 'bg-primary/10 font-semibold text-primary',
                  isSelected && 'bg-primary text-primary-foreground font-semibold',
                  !isSelected && !isToday(day) && 'text-foreground'
                )}
              >
                {format(day, 'd')}
                {(hasApts || hasEvts) && !isSelected && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {hasApts && <div className="w-1 h-1 rounded-full bg-primary" />}
                    {hasEvts && <div className="w-1 h-1 rounded-full bg-amber-500" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <EventDialog 
        open={eventDialogOpen} 
        onOpenChange={setEventDialogOpen}
        selectedDate={clickedDate}
        onEventSaved={loadEventDates}
      />
    </>
  );
}
