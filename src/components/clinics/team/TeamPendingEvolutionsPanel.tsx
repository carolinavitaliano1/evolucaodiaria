import { ComplianceDashboard } from '@/components/clinics/ComplianceDashboard';

interface Props {
  clinicId: string;
  organizationId: string | null;
}

export function TeamPendingEvolutionsPanel({ clinicId, organizationId }: Props) {
  if (!organizationId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Esta clínica ainda não pertence a uma organização.
      </div>
    );
  }
  return <ComplianceDashboard clinicId={clinicId} organizationId={organizationId} />;
}