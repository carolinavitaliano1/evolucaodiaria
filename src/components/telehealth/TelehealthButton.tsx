import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useTelehealthAccess } from '@/hooks/useTelehealthAccess';
import { StartTelehealthDialog } from './StartTelehealthDialog';

interface Props {
  patientId: string;
  patientName?: string;
  clinicId?: string | null;
  appointmentId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  iconOnly?: boolean;
}

export function TelehealthButton({
  patientId,
  patientName,
  clinicId,
  appointmentId,
  variant = 'outline',
  size = 'sm',
  className,
  iconOnly,
}: Props) {
  const { clinics } = useApp();
  const clinic = clinics.find((c) => c.id === clinicId);
  const { enabled, reason } = useTelehealthAccess(clinic?.type);
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        title={reason || 'Iniciar teleatendimento'}
      >
        <Video className={iconOnly ? 'w-4 h-4' : 'w-3.5 h-3.5 mr-1.5'} />
        {!iconOnly && 'Teleatendimento'}
      </Button>
      <StartTelehealthDialog
        open={open}
        onOpenChange={setOpen}
        patientId={patientId}
        patientName={patientName}
        clinicId={clinicId ?? null}
        appointmentId={appointmentId}
      />
    </>
  );
}