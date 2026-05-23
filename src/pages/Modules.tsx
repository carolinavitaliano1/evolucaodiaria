import { Helmet } from 'react-helmet-async';
import { Sparkles } from 'lucide-react';
import { SPECIALTY_MODULES } from '@/modules/specialties/config';
import { ModulePaywall } from '@/modules/specialties/ModulePaywall';

export default function Modules() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <Helmet>
        <title>Módulos por Especialidade | Evolução Diária</title>
        <meta
          name="description"
          content="Ative módulos por especialidade: psicopedagogia, psicologia, fonoaudiologia, psicomotricidade, nutrição e terapia ocupacional."
        />
      </Helmet>

      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Novo
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Módulos por Especialidade
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Cada módulo adiciona um prontuário especializado dentro do paciente —
          com avaliações, planos, sessões e relatórios com IA. Add-ons à sua
          assinatura principal, R$ 39/mês cada. Cancele quando quiser.
        </p>
      </header>

      <div className="grid gap-4">
        {SPECIALTY_MODULES.map((m) => (
          <ModulePaywall key={m.id} module={m} />
        ))}
      </div>
    </div>
  );
}
