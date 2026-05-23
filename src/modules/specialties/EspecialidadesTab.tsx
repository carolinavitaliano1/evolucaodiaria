import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Lock } from 'lucide-react';
import { SPECIALTY_MODULES, type ModuleId } from './config';
import { useModuleAccess } from './useModuleAccess';
import { ModulePaywall } from './ModulePaywall';
import { PsicopedagogoModule } from '../psicopedagogo/PsicopedagogoModule';
import { PsicomotricistaModule } from '../psicomotricista/PsicomotricistaModule';

interface Props {
  patientId: string;
}

function ModuleContent({ patientId, moduleId }: { patientId: string; moduleId: ModuleId }) {
  const { hasAccess, loading } = useModuleAccess(moduleId);
  const mod = SPECIALTY_MODULES.find((m) => m.id === moduleId)!;

  if (loading) {
    return <div className="h-40 animate-pulse bg-muted rounded-xl" />;
  }
  if (!hasAccess) {
    return <ModulePaywall module={mod} />;
  }
  if (moduleId === 'psicopedagogo') {
    return <PsicopedagogoModule patientId={patientId} />;
  }
  if (moduleId === 'psicomotricista') {
    return <PsicomotricistaModule patientId={patientId} />;
  }
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Conteúdo deste módulo em construção. Em breve.
    </div>
  );
}

export function EspecialidadesTab({ patientId }: Props) {
  const [active, setActive] = useState<ModuleId>('psicopedagogo');

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as ModuleId)} className="space-y-4">
      <TabsList className="w-full bg-transparent h-auto p-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SPECIALTY_MODULES.map((m) => {
          const Icon = m.icon;
          const isComingSoon = m.status === 'coming_soon';
          return (
            <TabsTrigger
              key={m.id}
              value={m.id}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-border bg-card shadow-sm text-muted-foreground text-[11px] font-medium hover:border-primary/30 data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:text-primary relative"
            >
              {isComingSoon && (
                <Lock className="absolute top-1 right-1 w-3 h-3 text-muted-foreground/60" />
              )}
              <Icon className={`w-4 h-4 shrink-0 ${m.color}`} />
              <span>{m.shortLabel}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {SPECIALTY_MODULES.map((m) => (
        <TabsContent key={m.id} value={m.id}>
          <ModuleContent patientId={patientId} moduleId={m.id} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
