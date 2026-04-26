import { useState } from 'react';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Sparkles, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { BASIC_PRICE_ID, PRO_PRICE_ID, CLINICA_PRO_PRICE_ID } from '@/lib/plans';
import { cn } from '@/lib/utils';

interface PlanDef {
  key: 'basic' | 'pro' | 'clinica_pro';
  name: string;
  price: string;
  description: string;
  priceId: string;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDef[] = [
  {
    key: 'basic',
    name: 'Básico',
    price: 'R$ 29,90',
    description: 'O essencial para sua prática clínica',
    priceId: BASIC_PRICE_ID,
    features: [
      'Clínicas, pacientes e agenda ilimitados',
      'Evoluções com texto livre e templates',
      'Controle financeiro completo',
      'WhatsApp, anexos e notas',
      '30 dias grátis para testar',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 59,90',
    description: 'Tudo que você precisa para escalar',
    priceId: PRO_PRICE_ID,
    popular: true,
    features: [
      'Tudo do plano Básico',
      'Inteligência Artificial completa (Doc IA, Melhorar Evolução, Feedbacks IA, Relatórios IA)',
      'Portal do Paciente (convites, fichas, mensagens)',
      '30 dias grátis para testar',
    ],
  },
  {
    key: 'clinica_pro',
    name: 'Clínica Pro',
    price: 'R$ 80,00',
    description: 'Para donos de clínica com equipe',
    priceId: CLINICA_PRO_PRICE_ID,
    features: [
      'Tudo do plano Pro',
      'Cadastro de Clínicas (multi-unidade com equipe)',
      'Equipe ilimitada de profissionais',
      'Permissões granulares por colaborador',
      'Dashboard financeiro de equipe',
      'Relatórios de remuneração',
      'Painel de conformidade da equipe',
      '30 dias grátis para testar',
    ],
  },
];

const COMPARISON: { label: string; basic: boolean; pro: boolean; clinicaPro: boolean }[] = [
  { label: 'Pacientes, agenda e evoluções', basic: true, pro: true, clinicaPro: true },
  { label: 'Controle financeiro', basic: true, pro: true, clinicaPro: true },
  { label: 'WhatsApp, anexos e notas', basic: true, pro: true, clinicaPro: true },
  { label: 'Consultório / Contratante (autônomo)', basic: true, pro: true, clinicaPro: false },
  { label: 'Doc IA, Melhorar Evolução, Feedbacks IA', basic: false, pro: true, clinicaPro: true },
  { label: 'Portal do Paciente', basic: false, pro: true, clinicaPro: true },
  { label: 'Cadastro de Clínicas (multi-unidade)', basic: false, pro: false, clinicaPro: true },
  { label: 'Equipe ilimitada de profissionais', basic: false, pro: false, clinicaPro: true },
  { label: 'Dashboard financeiro de equipe', basic: false, pro: false, clinicaPro: true },
  { label: 'Painel de conformidade da equipe', basic: false, pro: false, clinicaPro: true },
];

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { subscribed, tier } = useSubscription();
  const { isOrgMember, isOwner, loading: permsLoading } = useOrgPermissions();

  // Terapeutas / colaboradores convidados não devem ver/visitar a página de Planos.
  // Quem decide a assinatura é o dono da conta. Redireciona para o dashboard.
  if (permsLoading) return null;
  if (isOrgMember && !isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubscribe(priceId: string) {
    setLoadingPlan(priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar pagamento');
    } finally {
      setLoadingPlan(null);
    }
  }

  function buttonLabelFor(planKey: 'basic' | 'pro' | 'clinica_pro') {
    if (!subscribed) return 'Começar Teste Grátis';
    if (tier === planKey) return 'Plano atual';
    if (planKey === 'clinica_pro') return 'Fazer upgrade para Clínica Pro';
    if (tier === 'basic' && planKey === 'pro') return 'Fazer upgrade para Pro';
    if (tier === 'pro' && planKey === 'basic') return 'Mudar para Básico';
    if (tier === 'clinica_pro') return planKey === 'pro' ? 'Mudar para Pro' : 'Mudar para Básico';
    if (tier === 'legacy') return planKey === 'pro' ? 'Migrar para Pro' : 'Mudar para Básico';
    return 'Assinar';
  }

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold text-foreground mb-3">Escolha seu plano</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comece com o Básico e cresça para o Pro quando precisar de IA e Portal do Paciente.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="w-4 h-4" />
          30 dias grátis em todos os planos
        </p>
        {subscribed && tier === 'legacy' && (
          <Badge variant="outline" className="mt-3 ml-2 text-primary border-primary">
            ✓ Você é Legado e mantém acesso Pro completo
          </Badge>
        )}
        {subscribed && (tier === 'basic' || tier === 'pro') && (
          <Badge variant="outline" className="mt-3 ml-2 text-primary border-primary">
            ✓ Você está no plano {tier === 'pro' ? 'Pro' : 'Básico'}
          </Badge>
        )}
        {subscribed && tier === 'clinica_pro' && (
          <Badge variant="outline" className="mt-3 ml-2 text-primary border-primary">
            ✓ Você está no plano Clínica Pro
          </Badge>
        )}
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const isCurrent = subscribed && tier === plan.key;
          return (
            <Card
              key={plan.priceId}
              className={cn(
                'relative flex flex-col',
                plan.popular ? 'border-primary shadow-lg md:scale-105' : 'border-border',
                isCurrent && 'ring-2 ring-primary'
              )}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Recomendado
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={loadingPlan !== null || isCurrent}
                >
                  {loadingPlan === plan.priceId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    buttonLabelFor(plan.key)
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-foreground text-center mb-4">Comparativo de recursos</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Recurso</th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground w-32">Básico</th>
                    <th className="text-center px-4 py-3 font-semibold text-primary w-32">Pro</th>
                    <th className="text-center px-4 py-3 font-semibold text-primary w-32">Clínica Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 text-foreground">{row.label}</td>
                      <td className="px-4 py-2.5 text-center">
                        {row.basic ? (
                          <Check className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.pro ? (
                          <Check className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.clinicaPro ? (
                          <Check className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
