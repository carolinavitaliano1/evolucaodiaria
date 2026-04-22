import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, LogOut, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Patient } from '@/types';

const REASONS = [
  'Alta clínica',
  'Transferência',
  'Desistência',
  'Mudança de cidade',
  'Financeiro',
  'Outro',
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  /** Pass `null` to reactivate, or { date, reason } to register departure. */
  onConfirm: (data: { date: string; reason: string } | null) => void | Promise<void>;
}

export function DeparturePatientDialog({ open, onOpenChange, patient, onConfirm }: Props) {
  const isInactive = !!patient.departureDate || !!patient.isArchived;
  const [date, setDate] = useState<Date>(new Date());
  const [reason, setReason] = useState<string>('Alta clínica');
  const [otherReason, setOtherReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && !isInactive) {
      setDate(new Date());
      setReason('Alta clínica');
      setOtherReason('');
    }
  }, [open, isInactive]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (isInactive) {
        await onConfirm(null);
      } else {
        const isoDate = format(date, 'yyyy-MM-dd');
        const finalReason = reason === 'Outro' ? otherReason.trim() || 'Outro' : reason;
        await onConfirm({ date: isoDate, reason: finalReason });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInactive ? <ArchiveRestore className="w-4 h-4 text-primary" /> : <LogOut className="w-4 h-4 text-warning" />}
            {isInactive ? 'Reativar paciente?' : 'Registrar saída da clínica'}
          </DialogTitle>
          <DialogDescription>
            {isInactive ? (
              <>
                O paciente <span className="font-semibold">{patient.name}</span> voltará a aparecer na agenda, lista ativa e dashboard.
                {patient.departureDate && (
                  <> Saída registrada em {format(new Date(patient.departureDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}.</>
                )}
              </>
            ) : (
              <>
                Define a data em que <span className="font-semibold">{patient.name}</span> deixou a clínica. A partir dessa data, ele
                não aparece mais na agenda nem na lista ativa, mas <span className="font-medium">o histórico financeiro e clínico de meses anteriores é preservado</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isInactive && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Data da saída <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === 'Outro' && (
                <Input
                  className="mt-2"
                  placeholder="Descreva o motivo (opcional)"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {isInactive ? 'Reativar' : 'Registrar saída'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
