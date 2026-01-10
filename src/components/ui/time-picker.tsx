import { useState } from 'react';
import { Clock, ChevronUp, ChevronDown, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const SESSION_DURATIONS = [
  { value: '30', label: '30 min' },
  { value: '40', label: '40 min' },
  { value: '50', label: '50 min' },
  { value: '60', label: '60 min' },
];

export function TimePicker({ value, onChange, label, placeholder = "Selecione o horário", className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'spinner' | 'manual'>('spinner');
  const [manualInput, setManualInput] = useState(value || '');
  const [selectedHour, setSelectedHour] = useState(() => {
    if (value) {
      const [h] = value.split(':');
      return parseInt(h, 10);
    }
    return 8;
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (value) {
      const [, m] = value.split(':');
      return parseInt(m, 10);
    }
    return 0;
  });

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleHourChange = (direction: 'up' | 'down') => {
    let newHour = direction === 'up' ? selectedHour + 1 : selectedHour - 1;
    if (newHour > 22) newHour = 6;
    if (newHour < 6) newHour = 22;
    setSelectedHour(newHour);
  };

  const handleMinuteChange = (direction: 'up' | 'down') => {
    let newMinute = direction === 'up' ? selectedMinute + 5 : selectedMinute - 5;
    if (newMinute >= 60) newMinute = 0;
    if (newMinute < 0) newMinute = 55;
    setSelectedMinute(newMinute);
  };

  const handleConfirm = () => {
    if (mode === 'manual') {
      // Validate manual input
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (timeRegex.test(manualInput)) {
        const [h, m] = manualInput.split(':').map(Number);
        onChange(formatTime(h, m));
        setIsOpen(false);
      }
    } else {
      onChange(formatTime(selectedHour, selectedMinute));
      setIsOpen(false);
    }
  };

  const handleQuickSelect = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    setSelectedHour(h);
    setSelectedMinute(m);
    onChange(time);
    setIsOpen(false);
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^\d:]/g, '');
    
    // Auto-format: add colon after 2 digits
    if (val.length === 2 && !val.includes(':')) {
      val = val + ':';
    }
    
    // Limit to HH:MM format
    if (val.length > 5) {
      val = val.slice(0, 5);
    }
    
    setManualInput(val);
  };

  const isValidManualTime = () => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(manualInput);
  };

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            {value || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-popover border border-border z-50" align="start">
          <div className="p-4 space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-secondary rounded-lg">
              <Button
                variant={mode === 'spinner' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setMode('spinner')}
              >
                <Clock className="h-4 w-4" />
                Seletor
              </Button>
              <Button
                variant={mode === 'manual' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => setMode('manual')}
              >
                <Keyboard className="h-4 w-4" />
                Digitar
              </Button>
            </div>

            {mode === 'manual' ? (
              /* Manual Input Mode */
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Digite o horário (ex: 08:45, 14:30)
                  </Label>
                  <Input
                    value={manualInput}
                    onChange={handleManualInputChange}
                    placeholder="HH:MM"
                    className="text-center text-2xl font-bold h-14"
                    maxLength={5}
                  />
                </div>
                {manualInput && !isValidManualTime() && (
                  <p className="text-sm text-destructive">
                    Formato inválido. Use HH:MM (ex: 08:45)
                  </p>
                )}
              </div>
            ) : (
              /* Spinner Mode */
              <>
                {/* Time Spinner */}
                <div className="flex items-center justify-center gap-4">
                  {/* Hours */}
                  <div className="flex flex-col items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleHourChange('up')}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-4xl font-bold text-primary w-16 text-center py-2">
                      {selectedHour.toString().padStart(2, '0')}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleHourChange('down')}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground mt-1">Hora</span>
                  </div>

                  <span className="text-4xl font-bold text-muted-foreground">:</span>

                  {/* Minutes */}
                  <div className="flex flex-col items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMinuteChange('up')}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <div className="text-4xl font-bold text-primary w-16 text-center py-2">
                      {selectedMinute.toString().padStart(2, '0')}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMinuteChange('down')}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground mt-1">Minuto (±5)</span>
                  </div>
                </div>

                {/* Quick Select Grid */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Horários rápidos:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
                      <Button
                        key={time}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs",
                          value === time && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => handleQuickSelect(time)}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Confirm Button */}
            <Button 
              className="w-full gradient-primary"
              onClick={handleConfirm}
              disabled={mode === 'manual' && !isValidManualTime()}
            >
              Confirmar {mode === 'manual' ? (isValidManualTime() ? manualInput : '') : formatTime(selectedHour, selectedMinute)}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface TimeWithDurationPickerProps {
  time: string;
  duration: string;
  onTimeChange: (time: string) => void;
  onDurationChange: (duration: string) => void;
  label?: string;
  className?: string;
}

export function TimeWithDurationPicker({ 
  time, 
  duration, 
  onTimeChange, 
  onDurationChange, 
  label,
  className 
}: TimeWithDurationPickerProps) {
  const calculateEndTime = () => {
    if (!time || !duration) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + parseInt(duration, 10);
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && <Label className="text-base font-medium">{label}</Label>}
      
      <div className="grid grid-cols-2 gap-3">
        <TimePicker 
          value={time} 
          onChange={onTimeChange}
          label="Horário de Início"
        />
        
        <div>
          <Label className="mb-2 block">Duração da Sessão</Label>
          <Select value={duration} onValueChange={onDurationChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Duração" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              {SESSION_DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {time && duration && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Sessão:</span>
          <span className="font-semibold text-foreground">
            {time} - {calculateEndTime()}
          </span>
          <span className="text-muted-foreground">({duration} min)</span>
        </div>
      )}
    </div>
  );
}
