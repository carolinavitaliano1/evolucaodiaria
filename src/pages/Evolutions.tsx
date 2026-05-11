import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ClipboardList, FileText, Loader2, Users } from 'lucide-react';
import { ClinicEvolutionsTab } from '@/components/clinics/ClinicEvolutionsTab';
import { BatchEvolutionPanel } from '@/components/evolutions/BatchEvolutionPanel';

const EvolutionTemplates = lazy(() => import('@/components/clinics/EvolutionTemplates'));

/**
 * Página global de Evoluções (acessível pelo terapeuta convidado e pelo dono).
 * - Aba "Evoluções do Dia / Lote": reusa ClinicEvolutionsTab (já contém calendário,
 *   listagem por dia, ações por evolução e botão de feedback em lote).
 * - Aba "Modelos": reusa EvolutionTemplates.
 * O usuário escolhe a clínica no topo (mostra apenas as clínicas que ele enxerga
 * via AppContext, que já respeita o vínculo com a organização).
 */
export default function Evolutions() {
  const { clinics } = useApp();
  const visibleClinics = useMemo(
    () => clinics.filter(c => !c.isArchived),
    [clinics],
  );
  const [clinicId, setClinicId] = useState<string>('');

  useEffect(() => {
    if (!clinicId && visibleClinics.length > 0) {
      setClinicId(visibleClinics[0].id);
    }
  }, [visibleClinics, clinicId]);

  const currentClinic = visibleClinics.find(c => c.id === clinicId);

  if (visibleClinics.length === 0) {
    return (
      <div className="p-6 max-w-3xl">
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma clínica disponível para você. Peça ao administrador da organização
          para vincular você a uma clínica.
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evoluções</h1>
          <p className="text-sm text-muted-foreground">
            Registre evoluções do dia, gere feedback em lote e gerencie seus modelos.
          </p>
        </div>
        {visibleClinics.length > 1 && (
          <div className="w-full sm:w-72">
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma clínica" /></SelectTrigger>
              <SelectContent>
                {visibleClinics.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {clinicId && (
        <Tabs defaultValue="day" className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-xl">
            <TabsTrigger value="day" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              <span>Dia / Lote</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-2">
              <Users className="w-4 h-4" />
              <span>Lote rápido</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              <span>Modelos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="mt-4">
            <ClinicEvolutionsTab clinicId={clinicId} clinic={currentClinic} />
          </TabsContent>

          <TabsContent value="batch" className="mt-4">
            {currentClinic && <BatchEvolutionPanel clinic={currentClinic} />}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <EvolutionTemplates clinicId={clinicId} />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}