import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Calendar, 
  CheckSquare, 
  Bell, 
  Users, 
  Clock, 
  Trash2,
  Plus
} from 'lucide-react';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

interface Event {
  id: string;
  title: string;
  type: string;
  description: string | null;
  date: string;
  time: string | null;
  end_time: string | null;
  all_day: boolean;
  reminder_minutes: number | null;
  color: string;
  completed: boolean;
}

const EVENT_TYPES = [
  { value: 'tarefa', label: 'Tarefa', icon: CheckSquare, color: '#22c55e' },
  { value: 'lembrete', label: 'Lembrete', icon: Bell, color: '#f59e0b' },
  { value: 'evento', label: 'Evento', icon: Calendar, color: '#6366f1' },
  { value: 'reuniao', label: 'Reunião', icon: Users, color: '#ec4899' },
];

const REMINDER_OPTIONS = [
  { value: '0', label: 'No horário' },
  { value: '5', label: '5 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 dia antes' },
];

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onEventSaved?: () => void;
}

export function EventDialog({ open, onOpenChange, selectedDate, onEventSaved }: EventDialogProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('tarefa');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('');

  useEffect(() => {
    if (open) {
      loadEvents();
      resetForm();
    }
  }, [open, selectedDate]);

  async function loadEvents() {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('date', dateStr)
        .order('time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle('');
    setEventType('tarefa');
    setDescription('');
    setTime('');
    setEndTime('');
    setAllDay(false);
    setReminderMinutes('');
    setShowForm(false);
  }

  async function saveEvent() {
    try {
      setSaving(true);

      if (!title) {
        toast.error('Preencha o título');
        return;
      }

      const typeConfig = EVENT_TYPES.find(t => t.value === eventType);

      const { error } = await supabase
        .from('events')
        .insert({
          user_id: DEMO_USER_ID,
          title,
          type: eventType,
          description: description || null,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: allDay ? null : time || null,
          end_time: allDay ? null : endTime || null,
          all_day: allDay,
          reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : null,
          color: typeConfig?.color || '#6366f1',
          completed: false
        });

      if (error) throw error;

      toast.success('Adicionado com sucesso!');
      resetForm();
      loadEvents();
      onEventSaved?.();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted(event: Event) {
    try {
      const { error } = await supabase
        .from('events')
        .update({ completed: !event.completed })
        .eq('id', event.id);

      if (error) throw error;
      loadEvents();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  }

  async function deleteEvent(eventId: string) {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      toast.success('Removido');
      loadEvents();
      onEventSaved?.();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Erro ao remover');
    }
  }

  const getTypeConfig = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[2];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Add Buttons */}
          {!showForm && (
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant="outline"
                    className="justify-start gap-2 h-auto py-3"
                    onClick={() => {
                      setEventType(type.value);
                      setShowForm(true);
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: type.color + '20' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: type.color }} />
                    </div>
                    <span>{type.label}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Add Form */}
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  {(() => {
                    const config = getTypeConfig(eventType);
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                        Nova {config.label}
                      </>
                    );
                  })()}
                </h4>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Digite o título..."
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="allDay"
                  checked={allDay}
                  onCheckedChange={(checked) => setAllDay(checked === true)}
                />
                <Label htmlFor="allDay" className="cursor-pointer text-sm">
                  Dia inteiro
                </Label>
              </div>

              {!allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="time">Horário</Label>
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Término</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Lembrete</Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem lembrete" />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes..."
                  rows={2}
                />
              </div>

              <Button onClick={saveEvent} disabled={saving} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {saving ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          )}

          {/* Events List */}
          {events.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                Neste dia ({events.length})
              </h4>
              <div className="space-y-2">
                {events.map(event => {
                  const config = getTypeConfig(event.type);
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={event.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        event.completed ? 'bg-muted/50 opacity-60' : 'hover:bg-muted/30'
                      }`}
                    >
                      <button
                        onClick={() => toggleCompleted(event)}
                        className="mt-0.5"
                      >
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            event.completed 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground'
                          }`}
                          style={{ borderColor: event.completed ? config.color : undefined, backgroundColor: event.completed ? config.color : undefined }}
                        >
                          {event.completed && (
                            <CheckSquare className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${event.completed ? 'line-through' : ''}`}>
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Icon className="w-3 h-3" style={{ color: config.color }} />
                          <span>{config.label}</span>
                          {event.time && (
                            <>
                              <Clock className="w-3 h-3 ml-1" />
                              <span>
                                {event.time.slice(0, 5)}
                                {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                              </span>
                            </>
                          )}
                          {event.all_day && <span>• Dia inteiro</span>}
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {event.description}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEvent(event.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {events.length === 0 && !showForm && !loading && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhum evento neste dia. Clique acima para adicionar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}