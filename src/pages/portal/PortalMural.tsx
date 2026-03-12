import { usePortal } from '@/contexts/PortalContext';
import { useAuth } from '@/contexts/AuthContext';
import { PatientFeed } from '@/components/feed/PatientFeed';
import { Newspaper } from 'lucide-react';

export default function PortalMural() {
  const { portalAccount, patient } = usePortal();
  const { user } = useAuth();

  if (!portalAccount || !patient || !user) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Carregando mural...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Newspaper className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Mural de Atividades</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Acompanhe novidades, fotos e conquistas compartilhadas pelo terapeuta.
      </p>

      <PatientFeed
        patientId={portalAccount.patient_id}
        therapistId={portalAccount.therapist_user_id}
        isTherapist={false}
        currentUserId={user.id}
        currentUserName={patient.name}
      />
    </div>
  );
}
