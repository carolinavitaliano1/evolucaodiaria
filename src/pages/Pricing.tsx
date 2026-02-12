import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const PLANS = [
  {
    name: 'Mensal',
    price: 'R$ 29',
    period: '/mês',
    description: 'Ideal para começar',
    priceId: 'price_1Sz87xDl2hex55TCI3ONELuq',
    features: [
      'Gestão de clínicas ilimitada',
      'Cadastro de pacientes',
      'Agenda completa',
      'Evoluções e relatórios',
      'Controle financeiro',
      '15 dias grátis para testar',
    ],
  },
  {
    name: 'Bimestral',
    price: 'R$ 49',
    period: '/2 meses',
    description: 'Mais popular',
    priceId: 'price_1Sz88ADl2hex55TCABAFO3OL',
    popular: true,
    features: [
      'Tudo do plano Mensal',
      'Economia de R$ 9 vs mensal',
      'Suporte prioritário',
      '15 dias grátis para testar',
    ],
  },
  {
    name: 'Trimestral',
    price: 'R$ 59',
    period: '/3 meses',
    description: 'Melhor custo-benefício',
    priceId: 'price_1Sz88LDl2hex55TCwzGTUplF',
    features: [
      'Tudo do plano Mensal',
      'Economia de R$ 28 vs mensal',
      'Suporte prioritário',
      '15 dias grátis para testar',
    ],
  },
];

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();
  const { subscribed } = useSubscription();

  async function handleSubscribe(priceId: string) {
    setLoadingPlan(priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar pagamento');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-3">Escolha seu plano</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Escolha o plano ideal para gerenciar suas clínicas, pacientes e evoluções.
          <span className="block mt-1 font-semibold text-primary">
            <Sparkles className="inline w-4 h-4 mr-1" />
            15 dias grátis em todos os planos!
          </span>
        </p>
        {subscribed && (
          <Badge variant="outline" className="mt-3 text-primary border-primary">
            ✓ Você já possui uma assinatura ativa
          </Badge>
        )}
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map((plan) => (
          <Card
            key={plan.priceId}
            className={`relative flex flex-col ${
              plan.popular
                ? 'border-primary shadow-lg scale-105'
                : 'border-border'
            }`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Mais Popular
              </Badge>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
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
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.priceId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : subscribed ? (
                  'Alterar Plano'
                ) : (
                  'Começar Teste Grátis'
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
