import { useState } from 'react';
import { Calendar, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePatientScheduleSlots } from '@/hooks/usePatientScheduleSlots';
import { PatientScheduleSlotsManager } from './PatientScheduleSlotsManager';

interface Props {
  patientId: string;
  clinicId: string;
  organizationId?: string | null;
}

export function PatientScheduleCard({ patientId, clinicId, organizationId }: Props) {
  const [open, setOpen] = useState(false);
  const { slots } = usePatientScheduleSlots(patientId);

  const therapistCount = new Set(slots.map(s => s.memberId)).size;

  return (
    <>
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Agenda do Paciente
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Settings className="w-4 h-4 mr-1" />
            Gerenciar Agenda
          </Button>
        </div>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum horário configurado ainda. Adicione horários e terapeutas para montar a agenda do paciente.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{slots.length}</strong> horário(s) cadastrado(s) com{' '}
            <strong className="text-foreground">{therapistCount}</strong> profissional(is).
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agenda do Paciente
            </DialogTitle>
          </DialogHeader>
          <PatientScheduleSlotsManager
            patientId={patientId}
            clinicId={clinicId}
            organizationId={organizationId}
          />
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}