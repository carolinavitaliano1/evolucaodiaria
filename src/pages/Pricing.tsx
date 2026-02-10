import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-1.5 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground">Evolução Diária</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Já tenho conta</Button>
            <Button size="sm" onClick={() => navigate('/auth')} className="gradient-primary">
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-4">Escolha seu plano</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para gerenciar suas clínicas, pacientes e evoluções.
            <span className="block mt-1 font-semibold text-primary">
            <Sparkles className="inline w-4 h-4 mr-1" />
              15 dias grátis em todos os planos!
            </span>
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
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
                  ) : (
                    'Começar Teste Grátis'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
