import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, CalendarDays, ClipboardList, AlertTriangle, Loader2 } from 'lucide-react';
import { TeamCommissionsPanel } from '@/components/clinics/team/TeamCommissionsPanel';
import { TeamSchedulesPanel } from '@/components/clinics/team/TeamSchedulesPanel';
import { TeamAttendancePanel } from '@/components/clinics/team/TeamAttendancePanel';
import { TeamPendingEvolutionsPanel } from '@/components/clinics/team/TeamPendingEvolutionsPanel';

interface Props {
  clinicId: string;
  clinicName: string;
}

export default function ClinicTeamTab({ clinicId, clinicName }: Props) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('clinics')
      .select('organization_id')
      .eq('id', clinicId)
      .maybeSingle()
      .then(({ data }) => {
        setOrganizationId((data?.organization_id as string) || null);
        setLoading(false);
      });
  }, [clinicId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Equipe</h2>
        <p className="text-sm text-muted-foreground">
          Comissões, agendas, frequência e evoluções pendentes dos colaboradores de <span className="font-medium">{clinicName}</span>.
        </p>
      </div>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Frequência</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Pendentes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="mt-4">
          <TeamCommissionsPanel clinicId={clinicId} organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <TeamSchedulesPanel clinicId={clinicId} organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <TeamAttendancePanel clinicId={clinicId} organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <TeamPendingEvolutionsPanel clinicId={clinicId} organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}