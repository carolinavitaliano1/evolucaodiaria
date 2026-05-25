import { useState } from 'react';
import { Lock, Sparkles, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import type { SpecialtyModule } from './config';

interface Props {
  module: SpecialtyModule;
  onSubscribed?: () => void;
  compact?: boolean;
}

export function ModulePaywall({ module, onSubscribed, compact }: Props) {
  const [loading, setLoading] = useState(false);
  const Icon = module.icon;
  const { tier } = useSubscription();
  const includedByPlan =
    tier === 'pro' ||
    tier === 'clinica_pro' ||
    tier === 'legacy' ||
    tier === 'trial' ||
    tier === 'owner';
  const planLabel =
    tier === 'clinica_pro' ? 'Clínica Pro' : tier === 'pro' ? 'Pro' : 'atual';

  async function handleSubscribe() {
    if (module.status !== 'available' || !module.stripePriceId) {
      toast.info('Este módulo estará disponível em breve.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-module-checkout', {
        body: { module_id: module.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.url;
      if (!url) throw new Error('URL de checkout indisponível');
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível iniciar o checkout');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6 sm:p-8 space-y-5">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className={`w-7 h-7 ${module.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-semibold text-foreground">Módulo {module.label}</h3>
            {module.status === 'coming_soon' ? (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="w-3 h-3" /> Em breve
              </Badge>
            ) : includedByPlan ? (
              <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
                <Check className="w-3 h-3" /> Incluído no seu plano
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1">
                <Lock className="w-3 h-3" /> Bloqueado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
        </div>
        <div className="text-right shrink-0">
          {includedByPlan ? (
            <>
              <p className="text-lg font-bold text-green-600">Grátis</p>
              <p className="text-xs text-muted-foreground line-through">R$ {module.price}/mês</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">R$ {module.price}</p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="grid sm:grid-cols-3 gap-3">
          {module.features.map((sec) => (
            <div key={sec.title} className="rounded-xl bg-card border border-border p-3 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sec.title}</p>
              <ul className="space-y-1">
                {sec.items.slice(0, 4).map((it) => (
                  <li key={it} className="text-xs text-foreground/80 flex gap-1.5">
                    <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {includedByPlan ? (
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Já incluído na sua assinatura {planLabel} — acesso liberado.
          </p>
        ) : (
          <>
        <Button
          onClick={handleSubscribe}
          disabled={loading || module.status !== 'available'}
          className="gap-2"
          size="lg"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {module.status === 'available' ? `Assinar por R$ ${module.price}/mês` : 'Em breve'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Add-on da sua assinatura principal. Cancele quando quiser.
        </p>
          </>
        )}
      </div>
    </div>
  );
}